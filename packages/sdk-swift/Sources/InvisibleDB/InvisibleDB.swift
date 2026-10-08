import Foundation
import Security

public struct InvisibleDBError: Error, LocalizedError {
    public let status: Int
    public let message: String
    public var errorDescription: String? { "InvisibleDB \(status): \(message)" }
}

public struct ListOptions {
    public var page: Int?; public var perPage: Int?; public var sort: String?; public var filter: String?; public var expand: String?
    public init(page: Int? = nil, perPage: Int? = nil, sort: String? = nil, filter: String? = nil, expand: String? = nil) {
        self.page = page; self.perPage = perPage; self.sort = sort; self.filter = filter; self.expand = expand
    }
}

public struct UploadPart {
    public let field: String
    public let filename: String
    public let mimeType: String
    public let data: Data
    public init(field: String, filename: String, mimeType: String, data: Data) {
        self.field = field; self.filename = filename; self.mimeType = mimeType; self.data = data
    }
}

public protocol InvisibleDBTokenStore {
    func load() throws -> String?
    func save(_ token: String) throws
    func clear() throws
}

public final class KeychainTokenStore: InvisibleDBTokenStore {
    private let service: String
    private let account: String
    public init(service: String = "app.invisibledb.sdk", account: String = "session") { self.service = service; self.account = account }
    public func load() throws -> String? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw InvisibleDBError(status: Int(status), message: "keychain read failed") }
        return String(data: data, encoding: .utf8)
    }
    public func save(_ token: String) throws {
        try clear()
        let data = Data(token.utf8)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account, kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw InvisibleDBError(status: Int(status), message: "keychain write failed") }
    }
    public func clear() throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw InvisibleDBError(status: Int(status), message: "keychain clear failed") }
    }
}

public final class InvisibleDB {
    public let baseUrl: String
    private let apiKey: String?
    private let tokenStore: InvisibleDBTokenStore
    private let session: URLSession
    private let retries: Int
    private let lock = NSLock()
    private var _userToken: String?

    public init(baseUrl: String, apiKey: String? = nil, tokenStore: InvisibleDBTokenStore = KeychainTokenStore(), timeout: TimeInterval = 15, retries: Int = 2) {
        self.baseUrl = baseUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.apiKey = apiKey
        self.tokenStore = tokenStore
        self.retries = retries
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout * 2
        self.session = URLSession(configuration: config)
        self._userToken = try? tokenStore.load()
    }

    public var isAuthenticated: Bool { lock.withLock { _userToken != nil } || apiKey != nil }

    private func credential() throws -> String {
        if let token = lock.withLock({ _userToken }) { return token }
        if let token = try tokenStore.load() { lock.withLock { _userToken = token }; return token }
        if let apiKey { return apiKey }
        throw InvisibleDBError(status: 401, message: "no credentials; authenticate a user or provide a server-side API key")
    }

    private func request(_ method: String, _ path: String, body: Data? = nil, contentType: String? = "application/json", query: [String: String] = [:]) async throws -> Any {
        var comps = URLComponents(string: baseUrl + path)!
        if !query.isEmpty { comps.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) } }
        var lastError: Error?
        for attempt in 0...retries {
            var req = URLRequest(url: comps.url!)
            req.httpMethod = method
            req.setValue("Bearer \(try credential())", forHTTPHeaderField: "Authorization")
            if let contentType { req.setValue(contentType, forHTTPHeaderField: "Content-Type") }
            req.httpBody = body
            do {
                let (data, response) = try await session.data(for: req)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if status == 401 { throw InvisibleDBError(status: 401, message: "invalid credentials") }
                if !(200..<300).contains(status) {
                    let text = String(data: data, encoding: .utf8).map { String($0.prefix(300)) } ?? "request failed"
                    if (status == 429 || status >= 500), attempt < retries {
                        try await Task.sleep(nanoseconds: UInt64(250_000_000 * (1 << attempt)))
                        continue
                    }
                    throw InvisibleDBError(status: status, message: text)
                }
                if status == 204 || data.isEmpty { return NSNull() }
                return try JSONSerialization.jsonObject(with: data)
            } catch {
                lastError = error
                if error is InvisibleDBError { throw error }
                if attempt >= retries { throw error }
                try await Task.sleep(nanoseconds: UInt64(250_000_000 * (1 << attempt)))
            }
        }
        throw lastError ?? InvisibleDBError(status: 0, message: "request failed")
    }

    @discardableResult
    public func authWithPassword(collection: String, identity: String, password: String) async throws -> [String: Any] {
        let body = try JSONSerialization.data(withJSONObject: ["identity": identity, "password": password])
        guard let result = try await request("POST", "/api/collections/\(collection)/auth-with-password", body: body) as? [String: Any], let token = result["token"] as? String else {
            throw InvisibleDBError(status: 500, message: "auth response missing token")
        }
        lock.withLock { _userToken = token }
        try tokenStore.save(token)
        return result
    }

    public func logout() throws { lock.withLock { _userToken = nil }; try tokenStore.clear() }
    public func collection(_ name: String) -> Collection { Collection(db: self, name: name) }
    public func fileUrl(collection: String, recordId: String, filename: String) -> String { "\(baseUrl)/api/files/\(collection)/\(recordId)/\(filename)" }

    public func vectorQuery(collection: String, embedding: [Double], limit: Int = 10) async throws -> [[String: Any]] {
        let body = try JSONSerialization.data(withJSONObject: ["collection": collection, "embedding": embedding, "limit": limit])
        let result = try await request("POST", "/api/vector/query", body: body) as! [String: Any]
        return result["results"] as? [[String: Any]] ?? []
    }

    public func health() async throws -> [String: Any] { try await request("GET", "/api/health") as! [String: Any] }

    fileprivate func upload(_ method: String, path: String, fields: [String: Any], files: [UploadPart]) async throws -> [String: Any] {
        let boundary = "InvisibleDB-\(UUID().uuidString)"
        var data = Data()
        for (key, value) in fields {
            data.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(key)\"\r\n\r\n\(value)\r\n".data(using: .utf8)!)
        }
        for file in files {
            data.append("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(file.field)\"; filename=\"\(file.filename)\"\r\nContent-Type: \(file.mimeType)\r\n\r\n".data(using: .utf8)!)
            data.append(file.data); data.append("\r\n".data(using: .utf8)!)
        }
        data.append("--\(boundary)--\r\n".data(using: .utf8)!)
        return try await request(method, path, body: data, contentType: "multipart/form-data; boundary=\(boundary)") as! [String: Any]
    }

    public func subscribe(collection: String, onEvent: @escaping ([String: Any]) -> Void) async throws -> RealtimeSubscription {
        let handshake = try await request("POST", "/api/realtime", body: Data()) as! [String: Any]
        guard let clientId = handshake["clientId"] as? String else { throw InvisibleDBError(status: 500, message: "realtime handshake missing clientId") }
        let body = try JSONSerialization.data(withJSONObject: ["clientId": clientId, "subscriptions": [collection]])
        _ = try await request("POST", "/api/realtime", body: body)
        var req = URLRequest(url: URL(string: "\(baseUrl)/api/realtime?clientId=\(clientId)")!)
        req.setValue("Bearer \(try credential())", forHTTPHeaderField: "Authorization")
        let task = Task {
            let (bytes, _) = try await session.bytes(for: req)
            for try await line in bytes.lines {
                guard line.hasPrefix("data:") else { continue }
                let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
                guard let data = payload.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
                onEvent(object)
            }
        }
        return RealtimeSubscription(task: task)
    }
}

public final class RealtimeSubscription {
    private let task: Task<Void, Error>
    fileprivate init(task: Task<Void, Error>) { self.task = task }
    public func cancel() { task.cancel() }
    deinit { task.cancel() }
}

public final class Collection {
    private let db: InvisibleDB
    public let name: String
    private var path: String { "/api/collections/\(name)/records" }
    fileprivate init(db: InvisibleDB, name: String) { self.db = db; self.name = name }

    public func getList(_ options: ListOptions = ListOptions()) async throws -> [String: Any] {
        var q: [String: String] = [:]
        if let v = options.page { q["page"] = String(v) }; if let v = options.perPage { q["perPage"] = String(v) }
        if let v = options.sort { q["sort"] = v }; if let v = options.filter { q["filter"] = v }; if let v = options.expand { q["expand"] = v }
        return try await db.request("GET", path, query: q) as! [String: Any]
    }
    public func getOne(_ id: String) async throws -> [String: Any] { try await db.request("GET", "\(path)/\(id)") as! [String: Any] }
    public func create(_ data: [String: Any]) async throws -> [String: Any] { try await db.request("POST", path, body: JSONSerialization.data(withJSONObject: data)) as! [String: Any] }
    public func update(_ id: String, _ data: [String: Any]) async throws -> [String: Any] { try await db.request("PATCH", "\(path)/\(id)", body: JSONSerialization.data(withJSONObject: data)) as! [String: Any] }
    public func delete(_ id: String) async throws { _ = try await db.request("DELETE", "\(path)/\(id)") }
    public func createWithFiles(_ data: [String: Any], files: [UploadPart]) async throws -> [String: Any] { try await db.upload("POST", path: path, fields: data, files: files) }
    public func updateWithFiles(_ id: String, _ data: [String: Any], files: [UploadPart]) async throws -> [String: Any] { try await db.upload("PATCH", path: "\(path)/\(id)", fields: data, files: files) }
    public func subscribe(_ onEvent: @escaping ([String: Any]) -> Void) async throws -> RealtimeSubscription { try await db.subscribe(collection: name, onEvent: onEvent) }
}

private extension NSLock {
    func withLock<T>(_ body: () throws -> T) rethrows -> T { lock(); defer { unlock() }; return try body() }
}
