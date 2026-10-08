import Foundation

/// InvisibleDB Swift SDK for iOS.
///
/// Two auth modes:
/// - API key (server-side only): full instance access. NEVER ship in app bundles.
/// - User auth (client-safe): authenticate as a PocketBase user, scoped by collection rules.
///
/// ```swift
/// // Client-side (in your iOS app)
/// let db = InvisibleDB(baseUrl: "https://acme.invisibledb.app")
/// try await db.authWithPassword(collection: "users", identity: "user@example.com", password: "secret")
/// let messages = try await db.collection("messages").getList()
/// ```
public struct InvisibleDBError: Error, LocalizedError {
    public let status: Int
    public let message: String
    public var errorDescription: String? { "InvisibleDB \(status): \(message)" }
    public init(status: Int, message: String) {
        self.status = status
        self.message = message
    }
}

public class InvisibleDB {
    public let baseUrl: String
    private let apiKey: String?
    private var userToken: String?

    public init(baseUrl: String, apiKey: String? = nil) {
        var url = baseUrl
        while url.hasSuffix("/") { url.removeLast() }
        self.baseUrl = url
        self.apiKey = apiKey
    }

    private func authHeader() throws -> String {
        if let token = userToken { return "Bearer \(token)" }
        if let key = apiKey { return "Bearer \(key)" }
        throw InvisibleDBError(status: 401, message: "no credentials: provide apiKey or call authWithPassword first")
    }

    @discardableResult
    func req(_ method: String, _ path: String, body: [String: Any]? = nil, query: [String: String]? = nil) async throws -> Any {
        var comps = URLComponents(string: baseUrl + path)!
        if let query = query, !query.isEmpty {
            comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        var request = URLRequest(url: comps.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(try authHeader(), forHTTPHeaderField: "Authorization")
        if let body = body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw InvisibleDBError(status: 401, message: "invalid credentials") }
        guard (200..<300).contains(status) else {
            let text = String(data: data, encoding: .utf8)?.prefix(300) ?? "request failed"
            throw InvisibleDBError(status: status, message: String(text))
        }
        if status == 204 || data.isEmpty { return NSNull() }
        return try JSONSerialization.jsonObject(with: data)
    }

    /// Authenticate as a PocketBase user (client-safe).
    @discardableResult
    public func authWithPassword(collection: String, identity: String, password: String) async throws -> [String: Any] {
        let res = try await req("POST", "/api/collections/\(collection)/auth-with-password",
            body: ["identity": identity, "password": password]) as! [String: Any]
        guard let token = res["token"] as? String else {
            throw InvisibleDBError(status: 500, message: "auth response missing token")
        }
        self.userToken = token
        return res
    }

    public func logout() { userToken = nil }
    public func isAuthenticated() -> Bool { userToken != nil || apiKey != nil }

    public func collection(_ name: String) -> Collection {
        Collection(db: self, name: name)
    }

    public func fileUrl(collection: String, recordId: String, filename: String) -> String {
        "\(baseUrl)/api/files/\(collection)/\(recordId)/\(filename)"
    }

    public func vectorQuery(collection: String, embedding: [Double], limit: Int = 10) async throws -> [[String: Any]] {
        let res = try await req("POST", "/api/vector/query",
            body: ["collection": collection, "embedding": embedding, "limit": limit]) as! [String: Any]
        return res["results"] as? [[String: Any]] ?? []
    }

    public func health() async throws -> [String: Any] {
        try await req("GET", "/api/health") as! [String: Any]
    }
}

public class Collection {
    private let db: InvisibleDB
    public let name: String
    private var path: String { "/api/collections/\(name)/records" }

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
        return try await db.req("GET", path, query: q) as! [String: Any]
    }

    public func getOne(_ id: String) async throws -> [String: Any] {
        try await db.req("GET", "\(path)/\(id)") as! [String: Any]
    }

    public func create(_ data: [String: Any]) async throws -> [String: Any] {
        try await db.req("POST", path, body: data) as! [String: Any]
    }

    public func update(_ id: String, _ data: [String: Any]) async throws -> [String: Any] {
        try await db.req("PATCH", "\(path)/\(id)", body: data) as! [String: Any]
    }

    public func delete(_ id: String) async throws {
        try await db.req("DELETE", "\(path)/\(id)")
    }
}
