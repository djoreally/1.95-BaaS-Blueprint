package invisibledb

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Offline tests against a JDK HttpServer stub. No network beyond 127.0.0.1. */
class InvisibleDBTest {
    data class Recorded(val method: String, val rawPath: String, val rawQuery: String?, val auth: String?, val body: String)
    data class Reply(val status: Int, val body: String = "")

    private lateinit var server: HttpServer
    private val seen = CopyOnWriteArrayList<Recorded>()
    @Volatile private var handler: (Recorded) -> Reply = { Reply(200, "{}") }

    @BeforeTest
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { ex ->
            val rec = Recorded(
                method = ex.requestMethod,
                rawPath = ex.requestURI.rawPath,
                rawQuery = ex.requestURI.rawQuery,
                auth = ex.requestHeaders.getFirst("Authorization"),
                body = ex.requestBody.readBytes().toString(Charsets.UTF_8),
            )
            seen.add(rec)
            val reply = handler(rec)
            val bytes = reply.body.toByteArray(Charsets.UTF_8)
            ex.responseHeaders.add("Content-Type", "application/json")
            ex.sendResponseHeaders(reply.status, if (bytes.isEmpty()) -1 else bytes.size.toLong())
            if (bytes.isNotEmpty()) ex.responseBody.use { it.write(bytes) }
            ex.close()
        }
        server.start()
    }

    @AfterTest
    fun stop() {
        server.stop(0)
        seen.clear()
        handler = { Reply(200, "{}") }
    }

    private fun base() = "http://127.0.0.1:${server.address.port}"

    @Suppress("UNCHECKED_CAST")
    private fun obj(value: Any?): Map<String, Any?> = value as Map<String, Any?>

    private val listBody = """{"page":1,"perPage":30,"totalItems":2,"totalPages":1,"items":[{"id":"a1","title":"one","meta":{"n":[1,2]}}]}"""

    @Test
    fun anonymousReadSendsNoAuthorizationHeader() {
        handler = { Reply(200, listBody) }
        val db = InvisibleDB(base())
        val page = db.collection("tasks").getList(perPage = 1)
        assertEquals(2, (page["totalItems"] as Number).toInt())
        assertNull(seen.single().auth)
        assertFalse(db.isAuthenticated())
    }

    @Test
    fun jsonIsParsedIntoPlainMapsAndLists() {
        handler = { Reply(200, listBody) }
        val page = InvisibleDB(base()).collection("tasks").getList()
        val items = page["items"]
        assertIs<List<*>>(items)
        val first = obj(items.first())
        assertEquals("one", first["title"])
        assertEquals(listOf<Any?>(1, 2), obj(first["meta"])["n"])
    }

    @Test
    fun signInStoresTokenAndSendsBearerOnLaterCalls() {
        handler = { rec ->
            if (rec.rawPath.endsWith("/auth-with-password")) Reply(200, """{"token":"tok-1","record":{"id":"u1"}}""")
            else Reply(200, listBody)
        }
        val db = InvisibleDB(base())
        db.authWithPassword("users", "a@b.test", "pw")
        assertTrue(db.isAuthenticated())
        db.collection("tasks").getList()
        assertEquals("Bearer tok-1", seen.last().auth)
        db.logout()
        assertFalse(db.isAuthenticated())
    }

    @Test
    fun serverKeyIsSentAsBearerWhenNoUserSession() {
        handler = { Reply(200, listBody) }
        InvisibleDB(base(), apiKey = "idb_live_k").collection("tasks").getList()
        assertEquals("Bearer idb_live_k", seen.single().auth)
    }

    @Test
    fun errorsCarryStatusCodeMessageAndData() {
        handler = { Reply(403, """{"message":"Not allowed.","data":{"owner":{"code":"forbidden"}}}""") }
        val err = assertFailsWith<InvisibleDBError> { InvisibleDB(base()).collection("tasks").create(mapOf("title" to "x")) }
        assertEquals(403, err.status)
        assertEquals(ErrorCode.FORBIDDEN, err.code)
        assertTrue(err.message?.endsWith("Not allowed.") == true, err.message)
        assertIs<Map<*, *>>(err.data)
    }

    @Test
    fun recordIdsArePercentEncodedInThePath() {
        handler = { Reply(200, """{"id":"x"}""") }
        InvisibleDB(base()).collection("tasks").getOne("a/b c")
        assertEquals("/api/collections/tasks/records/a%2Fb%20c", seen.single().rawPath)
    }

    @Test
    fun filterValuesArePercentEncoded() {
        handler = { Reply(200, listBody) }
        InvisibleDB(base()).collection("tasks").getList(filter = "title = \"a+b&c\"")
        val raw = seen.single().rawQuery ?: ""
        assertTrue(raw.contains("%2B"), raw)
        assertTrue(raw.contains("%26"), raw)
        assertTrue(raw.contains("%22"), raw)
    }

    @Test
    fun deleteAcceptsNoContent() {
        handler = { Reply(204) }
        InvisibleDB(base()).collection("tasks").delete("a1")
        assertEquals("DELETE", seen.single().method)
    }

    @Test
    fun getIsRetriedOnServiceUnavailable() {
        var calls = 0
        handler = { Reply(if (++calls == 1) 503 else 200, if (calls == 1) """{"message":"busy"}""" else listBody) }
        val db = InvisibleDB(base(), maxAttempts = 3, retryBaseMs = 1)
        db.collection("tasks").getList()
        assertEquals(2, seen.size)
    }

    @Test
    fun postIsNeverRetried() {
        handler = { Reply(503, """{"message":"busy"}""") }
        val db = InvisibleDB(base(), maxAttempts = 3, retryBaseMs = 1)
        val err = assertFailsWith<InvisibleDBError> { db.collection("tasks").create(mapOf("title" to "x")) }
        assertEquals(ErrorCode.SERVER_ERROR, err.code)
        assertEquals(1, seen.size)
    }

    @Test
    fun rpcPostsParamsToTheRpcRoute() {
        handler = { Reply(200, """{"id":"abc","status":"done"}""") }
        val out = InvisibleDB(base(), apiKey = "k").rpc("complete_task", mapOf("id" to "abc"))
        assertEquals("done", obj(out)["status"])
        val rec = seen.single()
        assertEquals("POST", rec.method)
        assertEquals("/api/invisibledb/rpc/complete_task", rec.rawPath)
        assertEquals("""{"id":"abc"}""", rec.body)
    }

    @Test
    fun functionsInvokeHitsTheFunctionsRoute() {
        handler = { Reply(200, """{"echo":{"a":1}}""") }
        val out = InvisibleDB(base()).functions.invoke("echo", mapOf("a" to 1))
        assertEquals(mapOf<String, Any?>("a" to 1), obj(out)["echo"])
        assertEquals("/api/invisibledb/functions/echo", seen.single().rawPath)
    }

    @Test
    fun invalidRuntimeNamesFailBeforeAnyRequest() {
        val db = InvisibleDB(base())
        for (bad in listOf("", "Upper", "1digit", "../escape", "has-dash", "x".repeat(65))) {
            val err = assertFailsWith<InvisibleDBError> { db.rpc(bad) }
            assertEquals(ErrorCode.BAD_REQUEST, err.code)
        }
        assertEquals(0, seen.size)
    }

    @Test
    fun connectionFailureIsANetworkError() {
        val port = java.net.ServerSocket(0).use { it.localPort }
        val err = assertFailsWith<InvisibleDBError> { InvisibleDB("http://127.0.0.1:$port", retryBaseMs = 1).health() }
        assertEquals(ErrorCode.NETWORK_ERROR, err.code)
        assertEquals(0, err.status)
    }

    @Test
    fun codeForStatusMapsTheSharedTable() {
        assertEquals(ErrorCode.BAD_REQUEST, codeForStatus(400))
        assertEquals(ErrorCode.UNAUTHENTICATED, codeForStatus(401))
        assertEquals(ErrorCode.NOT_FOUND, codeForStatus(404))
        assertEquals(ErrorCode.RATE_LIMITED, codeForStatus(429))
        assertEquals(ErrorCode.SERVER_ERROR, codeForStatus(502))
        assertEquals(ErrorCode.HTTP_ERROR, codeForStatus(418))
    }
}
