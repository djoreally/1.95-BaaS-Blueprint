import XCTest
@testable import InvisibleDB

/// Routes every request through a closure. No network.
final class MockProtocol: URLProtocol {
    struct Reply {
        var status: Int
        var body: Data = Data()
        var headers: [String: String] = [:]
    }

    static var handler: ((URLRequest) throws -> Reply)?
    static var seen: [URLRequest] = []

    static func reset() {
        handler = nil
        seen = []
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        MockProtocol.seen.append(request)
        guard let handler = MockProtocol.handler else {
            client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse))
            return
        }
        do {
            let reply = try handler(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: reply.status,
                                           httpVersion: "HTTP/1.1", headerFields: reply.headers)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            if !reply.body.isEmpty { client?.urlProtocol(self, didLoad: reply.body) }
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

func json(_ object: Any) -> Data {
    try! JSONSerialization.data(withJSONObject: object)
}

final class InvisibleDBTests: XCTestCase {
    var db: InvisibleDB!

    override func setUp() {
        super.setUp()
        MockProtocol.reset()
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockProtocol.self]
        let session = URLSession(configuration: config)
        db = InvisibleDB(baseUrl: "https://acme.invisibledb.test", session: session)
        db.retryBaseDelayNanos = 1_000
    }

    override func tearDown() {
        MockProtocol.reset()
        super.tearDown()
    }

    private let listBody: [String: Any] = [
        "page": 1, "perPage": 30, "totalItems": 2, "totalPages": 1,
        "items": [["id": "a1", "title": "one", "meta": ["n": [1, 2]]]],
    ]

    func testAnonymousReadSendsNoAuthorizationHeader() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: json(self.listBody)) }
        let page = try await db.collection("tasks").getList(perPage: 1)
        XCTAssertEqual(page["totalItems"] as? Int, 2)
        XCTAssertNil(MockProtocol.seen.last?.value(forHTTPHeaderField: "Authorization"))
        XCTAssertFalse(db.isAuthenticated())
    }

    func testJsonIsParsedIntoNativeTypes() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: json(self.listBody)) }
        let page = try await db.collection("tasks").getList()
        let items = try XCTUnwrap(page["items"] as? [[String: Any]])
        XCTAssertEqual(items.first?["title"] as? String, "one")
    }

    func testSignInStoresTokenAndSendsBearer() async throws {
        MockProtocol.handler = { request in
            if request.url!.path.hasSuffix("/auth-with-password") {
                return MockProtocol.Reply(status: 200, body: json(["token": "tok-1", "record": ["id": "u1"]]))
            }
            return MockProtocol.Reply(status: 200, body: json(self.listBody))
        }
        try await db.authWithPassword(collection: "users", identity: "a@b.test", password: "pw")
        XCTAssertTrue(db.isAuthenticated())
        _ = try await db.collection("tasks").getList()
        XCTAssertEqual(MockProtocol.seen.last?.value(forHTTPHeaderField: "Authorization"), "Bearer tok-1")
        db.logout()
        XCTAssertFalse(db.isAuthenticated())
    }

    func testServerKeyIsSentWhenNoUserSession() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: json(self.listBody)) }
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockProtocol.self]
        let keyed = InvisibleDB(baseUrl: "https://x.test", apiKey: "idb_live_k", session: URLSession(configuration: config))
        _ = try await keyed.collection("tasks").getList()
        XCTAssertEqual(MockProtocol.seen.last?.value(forHTTPHeaderField: "Authorization"), "Bearer idb_live_k")
    }

    func testErrorCarriesStatusCodeMessageAndRequestId() async {
        MockProtocol.handler = { _ in
            MockProtocol.Reply(status: 403, body: json(["message": "Not allowed.", "data": [:]]),
                               headers: ["X-Request-Id": "req-9"])
        }
        do {
            _ = try await db.collection("tasks").create(["title": "x"])
            XCTFail("expected an error")
        } catch let error as InvisibleDBError {
            XCTAssertEqual(error.status, 403)
            XCTAssertEqual(error.code, .forbidden)
            XCTAssertEqual(error.message, "Not allowed.")
            XCTAssertEqual(error.requestId, "req-9")
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testRecordIdIsPercentEncodedInPath() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: json(["id": "x"])) }
        _ = try await db.collection("tasks").getOne("a/b c")
        XCTAssertEqual(MockProtocol.seen.last?.url?.path, "/api/collections/tasks/records/a%2Fb%20c")
    }

    func testQueryValuesAreStrictlyEncoded() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: json(self.listBody)) }
        _ = try await db.collection("tasks").getList(filter: "title = \"a+b&c\"")
        let raw = try XCTUnwrap(MockProtocol.seen.last?.url?.absoluteString)
        XCTAssertTrue(raw.contains("%2B"), raw)
        XCTAssertTrue(raw.contains("%26"), raw)
        XCTAssertTrue(raw.contains("%22"), raw)
    }

    func testDeleteAcceptsNoContent() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 204) }
        try await db.collection("tasks").delete("a1")
        XCTAssertEqual(MockProtocol.seen.last?.httpMethod, "DELETE")
    }

    func testGetIsRetriedOnServiceUnavailable() async throws {
        var calls = 0
        MockProtocol.handler = { _ in
            calls += 1
            return calls == 1 ? MockProtocol.Reply(status: 503, body: json(["message": "busy"]))
                              : MockProtocol.Reply(status: 200, body: json(self.listBody))
        }
        _ = try await db.collection("tasks").getList()
        XCTAssertEqual(MockProtocol.seen.count, 2)
    }

    func testPostIsNeverRetried() async {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 503, body: json(["message": "busy"])) }
        do {
            _ = try await db.collection("tasks").create(["title": "x"])
            XCTFail("expected an error")
        } catch let error as InvisibleDBError {
            XCTAssertEqual(error.code, .serverError)
            XCTAssertEqual(MockProtocol.seen.count, 1)
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }

    func testRpcPostsToRpcRoute() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: json(["id": "abc", "status": "done"])) }
        let result = try await db.rpc("complete_task", params: ["id": "abc"])
        let out = try XCTUnwrap(result as? [String: Any])
        XCTAssertEqual(out["status"] as? String, "done")
        XCTAssertEqual(MockProtocol.seen.last?.httpMethod, "POST")
        XCTAssertEqual(MockProtocol.seen.last?.url?.path, "/api/invisibledb/rpc/complete_task")
    }

    func testFunctionsInvokeHitsFunctionsRoute() async throws {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: json(["echo": ["a": 1]])) }
        _ = try await db.functions.invoke("echo", payload: ["a": 1])
        XCTAssertEqual(MockProtocol.seen.last?.url?.path, "/api/invisibledb/functions/echo")
    }

    func testInvalidRuntimeNamesFailBeforeAnyRequest() async {
        for bad in ["", "Upper", "1digit", "../escape", "has-dash", String(repeating: "x", count: 65)] {
            do {
                _ = try await db.rpc(bad)
                XCTFail("accepted \(bad)")
            } catch let error as InvisibleDBError {
                XCTAssertEqual(error.code, .badRequest)
            } catch {
                XCTFail("wrong error type: \(error)")
            }
        }
        XCTAssertEqual(MockProtocol.seen.count, 0)
    }

    func testInvalidJsonOnSuccessIsAnError() async {
        MockProtocol.handler = { _ in MockProtocol.Reply(status: 200, body: Data("<html>".utf8)) }
        do {
            _ = try await db.health()
            XCTFail("expected an error")
        } catch let error as InvisibleDBError {
            XCTAssertEqual(error.code, .httpError)
        } catch {
            XCTFail("wrong error type: \(error)")
        }
    }
}
