import Foundation

/// InvisibleDB Swift SDK for iOS and macOS.
///
/// Two credential lanes:
/// - Server key (server-side only). NEVER ship it in an app bundle.
/// - End-user session via `authWithPassword` (client-safe, scoped by collection rules).
///
/// Anonymous calls are allowed. A request carries an Authorization header only when a credential is set.
///
/// ```swift
/// let db = InvisibleDB(baseUrl: "https://acme.invisibledb.app")
/// let page = try await db.collection("tasks").getList(filter: "status = \"open\"")
/// ```
public struct InvisibleDBError: Error, LocalizedError {
    /// Stable error codes shared with every InvisibleDB SDK.
    public enum Code: String, Sendable {
        case badRequest = "bad_request"
        case unauthenticated = "unauthenticated"
        case forbidden = "forbidden"
        case notFound = "not_found"
        case conflict = "conflict"
        case payloadTooLarge = "payload_too_large"
        case rateLimited = "rate_limited"
        case serverError = "server_error"
        case httpError = "http_error"
        case networkError = "network_error"
        case timeout = "timeout"

        public static func forStatus(_ status: Int) -> Code {
            switch status {
            case 400: return .badRequest
            case 401: return .unauthenticated
            case 403: return .forbidden
            case 404: return .notFound
            case 409: return .conflict
            case 413: return .payloadTooLarge
            case 429: return .rateLimited
            default: return status >= 500 ? .serverError : .httpError
            }
        }
    }

    /// HTTP status, or 0 when no response was received (network error, timeout, or local validation).
    public let status: Int
    public let message: String
    public let code: Code
    /// Server `X-Request-Id`, when returned.
    public let requestId: String?
    /// Parsed `data` from the server error body (per-field validation details).
    public let data: Any?

    public init(status: Int, message: String, code: Code? = nil, requestId: String? = nil, data: Any? = nil) {
        self.status = status
        self.message = message
        self.code = code ?? (status == 0 ? .networkError : Code.forStatus(status))
        self.requestId = requestId
        self.data = data
    }

    public var errorDescription: String? { "InvisibleDB \(status): \(message)" }
}

/// Percent-encoding for one path segment or one query value. Strict: everything except unreserved characters is encoded.
enum PctEncode {
    static let unreserved: CharacterSet = {
        var set = CharacterSet.alphanumerics
        set.insert(charactersIn: "-._~")
        return set
    }()

    static func segment(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: unreserved) ?? value
    }
}

private let runtimeNameMaxLength = 64

private func isRuntimeName(_ name: String) -> Bool {
    let scalars = Array(name.unicodeScalars)
    guard !scalars.isEmpty, scalars.count <= runtimeNameMaxLength else { return false }
    func isLower(_ v: UInt32) -> Bool { v >= 97 && v <= 122 }
    func isDigit(_ v: UInt32) -> Bool { v >= 48 && v <= 57 }
    guard isLower(scalars[0].value) else { return false }
    return scalars.allSatisfy { isLower($0.value) || isDigit($0.value) || $0.value == 95 }
}

public final class InvisibleDB {
    public let baseUrl: String
    private let apiKey: String?
    private var userToken: String?
    private let session: URLSession

    /// Per-attempt timeout in seconds.
    public var timeout: TimeInterval = 30
    /// Total attempts for idempotent requests (GET, HEAD, PUT, DELETE). Other methods are never retried.
    public var maxAttempts: Int = 3
    /// Base delay for exponential backoff, in nanoseconds.
    public var retryBaseDelayNanos: UInt64 = 250_000_000

    /// Server functions: `db.functions.invoke("echo", payload: [...])`.
    public var functions: Functions { Functions(db: self) }

    public init(baseUrl: String, apiKey: String? = nil, session: URLSession = .shared) {
        var url = baseUrl
        while url.hasSuffix("/") { url.removeLast() }
        self.baseUrl = url
        self.apiKey = apiKey
        self.session = session
    }

    private func authHeader() -> String? {
        if let token = userToken { return "Bearer \(token)" }
        if let key = apiKey { return "Bearer \(key)" }
        return nil
    }

    /// Send a request. `path` must already be percent-encoded per segment (see `PctEncode.segment`).
    @discardableResult
    func req(_ method: String, _ path: String, body: [String: Any]? = nil, query: [String: String]? = nil) async throws -> Any {
        var urlString = baseUrl + path
        if let query = query, !query.isEmpty {
            let qs = query.sorted { $0.key < $1.key }
                .map { "\(PctEncode.segment($0.key))=\(PctEncode.segment($0.value))" }
                .joined(separator: "&")
            urlString += "?" + qs
        }
        guard let url = URL(string: urlString) else {
            throw InvisibleDBError(status: 0, message: "invalid URL", code: .badRequest)
        }
        let bodyData: Data?
        do {
            bodyData = try body.map { try JSONSerialization.data(withJSONObject: $0) }
        } catch {
            throw InvisibleDBError(status: 0, message: "request body is not valid JSON", code: .badRequest)
        }

        let idempotent = ["GET", "HEAD", "PUT", "DELETE"].contains(method)
        let attempts = idempotent ? max(1, maxAttempts) : 1
        var attempt = 1
        while true {
            do {
                return try await once(method, url, bodyData)
            } catch let error as InvisibleDBError {
                let retryable = error.status == 0 || [429, 502, 503, 504].contains(error.status)
                if !retryable || attempt >= attempts { throw error }
                try await Task.sleep(nanoseconds: retryBaseDelayNanos * UInt64(1 << (attempt - 1)))
                attempt += 1
            }
        }
    }

    private func once(_ method: String, _ url: URL, _ bodyData: Data?) async throws -> Any {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if bodyData != nil { request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        if let auth = authHeader() { request.setValue(auth, forHTTPHeaderField: "Authorization") }
        request.httpBody = bodyData

        let result: (Data, URLResponse)
        do {
            result = try await session.data(for: request)
        } catch let error as URLError {
            let code: InvisibleDBError.Code = error.code == .timedOut ? .timeout : .networkError
            throw InvisibleDBError(status: 0, message: error.localizedDescription, code: code)
        } catch {
            throw InvisibleDBError(status: 0, message: error.localizedDescription, code: .networkError)
        }
        let (data, response) = result
        guard let http = response as? HTTPURLResponse else {
            throw InvisibleDBError(status: 0, message: "no HTTP response", code: .networkError)
        }
        let status = http.statusCode
        let requestId = http.value(forHTTPHeaderField: "X-Request-Id")

        guard (200..<300).contains(status) else {
            let parsed = InvisibleDB.parseError(data)
            throw InvisibleDBError(status: status, message: parsed.message, requestId: requestId, data: parsed.data)
        }
        if status == 204 || data.isEmpty { return NSNull() }
        do {
            return try JSONSerialization.jsonObject(with: data)
        } catch {
            throw InvisibleDBError(status: status, message: "response was not valid JSON", code: .httpError, requestId: requestId)
        }
    }

    private static func parseError(_ data: Data) -> (message: String, data: Any?) {
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let message = object["message"] as? String {
            return (message, object["data"])
        }
        let text = String(data: data, encoding: .utf8) ?? ""
        return (text.isEmpty ? "request failed" : String(text.prefix(300)), nil)
    }

    fileprivate static func object(_ value: Any) throws -> [String: Any] {
        guard let object = value as? [String: Any] else {
            throw InvisibleDBError(status: 200, message: "unexpected response shape", code: .httpError)
        }
        return object
    }

    /// Sign in as a PocketBase auth collection user. The token is kept for later calls.
    @discardableResult
    public func authWithPassword(collection: String, identity: String, password: String) async throws -> [String: Any] {
        let res = try InvisibleDB.object(
            try await req("POST", "/api/collections/\(PctEncode.segment(collection))/auth-with-password",
                          body: ["identity": identity, "password": password]))
        guard let token = res["token"] as? String else {
            throw InvisibleDBError(status: 200, message: "auth response missing token", code: .httpError)
        }
        userToken = token
        return res
    }

    public func logout() { userToken = nil }

    /// True when a user session or a server key is set. Anonymous access does not count.
    public func isAuthenticated() -> Bool { userToken != nil || apiKey != nil }

    public func collection(_ name: String) -> RecordCollection {
        RecordCollection(db: self, name: name)
    }

    public func fileUrl(collection: String, recordId: String, filename: String) -> String {
        "\(baseUrl)/api/files/\(PctEncode.segment(collection))/\(PctEncode.segment(recordId))/\(PctEncode.segment(filename))"
    }

    public func vectorQuery(collection: String, embedding: [Double], limit: Int = 10) async throws -> [[String: Any]] {
        let res = try InvisibleDB.object(
            try await req("POST", "/api/vector/query",
                          body: ["collection": collection, "embedding": embedding, "limit": limit]))
        return res["results"] as? [[String: Any]] ?? []
    }

    public func health() async throws -> [String: Any] {
        try InvisibleDB.object(try await req("GET", "/api/health"))
    }

    /// Call a server procedure (runtime contract v1). Not retried automatically.
    /// Names must match `^[a-z][a-z0-9_]{0,63}$`.
    @discardableResult
    public func rpc(_ name: String, params: [String: Any] = [:]) async throws -> Any {
        try await invokeRuntime(kind: "rpc", name: name, body: params)
    }

    fileprivate func invokeRuntime(kind: String, name: String, body: [String: Any]) async throws -> Any {
        guard isRuntimeName(name) else {
            throw InvisibleDBError(status: 0, message: "invalid \(kind) name: \(name)", code: .badRequest)
        }
        let route = kind == "rpc" ? "rpc" : "functions"
        return try await req("POST", "/api/invisibledb/\(route)/\(PctEncode.segment(name))", body: body)
    }
}

/// Server functions namespace (`db.functions.invoke`).
public struct Functions {
    fileprivate let db: InvisibleDB

    public func invoke(_ name: String, payload: [String: Any] = [:]) async throws -> Any {
        try await db.invokeRuntime(kind: "function", name: name, body: payload)
    }
}

/// Records of one collection. Named RecordCollection so it does not shadow Swift's Collection protocol.
public final class RecordCollection {
    private let db: InvisibleDB
    public let name: String
    private var path: String { "/api/collections/\(PctEncode.segment(name))/records" }

    init(db: InvisibleDB, name: String) {
        self.db = db
        self.name = name
    }

    public func getList(page: Int? = nil, perPage: Int? = nil, sort: String? = nil,
                        filter: String? = nil, expand: String? = nil) async throws -> [String: Any] {
        var q: [String: String] = [:]
        if let page = page { q["page"] = String(page) }
        if let perPage = perPage { q["perPage"] = String(perPage) }
        if let sort = sort { q["sort"] = sort }
        if let filter = filter { q["filter"] = filter }
        if let expand = expand { q["expand"] = expand }
        return try InvisibleDB.object(try await db.req("GET", path, query: q))
    }

    public func getOne(_ id: String) async throws -> [String: Any] {
        try InvisibleDB.object(try await db.req("GET", "\(path)/\(PctEncode.segment(id))"))
    }

    public func create(_ data: [String: Any]) async throws -> [String: Any] {
        try InvisibleDB.object(try await db.req("POST", path, body: data))
    }

    public func update(_ id: String, _ data: [String: Any]) async throws -> [String: Any] {
        try InvisibleDB.object(try await db.req("PATCH", "\(path)/\(PctEncode.segment(id))", body: data))
    }

    public func delete(_ id: String) async throws {
        try await db.req("DELETE", "\(path)/\(PctEncode.segment(id))")
    }
}
