package invisibledb

import java.io.IOException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * InvisibleDB Kotlin SDK (Android / JVM).
 *
 * Two credential lanes:
 * - Server key (server-side only). NEVER ship it in an app bundle.
 * - End-user session via [InvisibleDB.authWithPassword] (client-safe, scoped by collection rules).
 *
 * Anonymous calls are allowed. A request carries an Authorization header only when a credential is set.
 *
 * ```kotlin
 * val db = InvisibleDB(baseUrl = "https://acme.invisibledb.app")
 * db.authWithPassword("users", "user@example.com", "secret")
 * val page = db.collection("tasks").getList(filter = "status = \"open\"")
 * ```
 */

/** Stable error codes shared with every InvisibleDB SDK. */
enum class ErrorCode(val wire: String) {
    BAD_REQUEST("bad_request"),
    UNAUTHENTICATED("unauthenticated"),
    FORBIDDEN("forbidden"),
    NOT_FOUND("not_found"),
    CONFLICT("conflict"),
    PAYLOAD_TOO_LARGE("payload_too_large"),
    RATE_LIMITED("rate_limited"),
    SERVER_ERROR("server_error"),
    HTTP_ERROR("http_error"),
    NETWORK_ERROR("network_error"),
    TIMEOUT("timeout"),
}

fun codeForStatus(status: Int): ErrorCode = when (status) {
    400 -> ErrorCode.BAD_REQUEST
    401 -> ErrorCode.UNAUTHENTICATED
    403 -> ErrorCode.FORBIDDEN
    404 -> ErrorCode.NOT_FOUND
    409 -> ErrorCode.CONFLICT
    413 -> ErrorCode.PAYLOAD_TOO_LARGE
    429 -> ErrorCode.RATE_LIMITED
    else -> if (status >= 500) ErrorCode.SERVER_ERROR else ErrorCode.HTTP_ERROR
}

/** [status] is 0 when no response was received (network error, timeout, or local validation). */
class InvisibleDBError(
    val status: Int,
    message: String,
    val code: ErrorCode = if (status == 0) ErrorCode.NETWORK_ERROR else codeForStatus(status),
    val requestId: String? = null,
    val data: Any? = null,
    cause: Throwable? = null,
) : Exception("InvisibleDB $status: $message", cause)

private val RUNTIME_NAME = Regex("^[a-z][a-z0-9_]{0,63}$")
private val RETRYABLE_STATUS = setOf(429, 502, 503, 504)
private val IDEMPOTENT = setOf("GET", "HEAD", "PUT", "DELETE")

/** Percent-encode one URL path segment (spaces become %20, slashes become %2F). */
internal fun seg(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")

/** Percent-encode a query value (form encoding; the server decodes + as a space in queries). */
internal fun qv(value: String): String = URLEncoder.encode(value, "UTF-8")

@Suppress("UNCHECKED_CAST")
internal fun asMap(value: Any?): Map<String, Any?> =
    value as? Map<String, Any?> ?: throw InvisibleDBError(200, "unexpected response shape", ErrorCode.HTTP_ERROR)

internal fun toKotlin(value: Any?): Any? = when (value) {
    is JSONObject -> value.keySet().associateWith { toKotlin(value.opt(it)) }
    is JSONArray -> (0 until value.length()).map { toKotlin(value.opt(it)) }
    JSONObject.NULL -> null
    else -> value
}

class InvisibleDB(
    baseUrl: String,
    private val apiKey: String? = null,
    private val timeoutMs: Int = 30_000,
    private val maxAttempts: Int = 3,
    private val retryBaseMs: Long = 250,
) {
    val baseUrl: String = baseUrl.trimEnd('/')
    private var userToken: String? = null

    /** rpc and functions. See [Functions]. */
    val functions = Functions(this)

    private fun credential(): String? = userToken ?: apiKey

    /**
     * Send a request. Idempotent methods (GET, HEAD, PUT, DELETE) retry network errors and
     * 429/502/503/504 with exponential backoff. Other methods are never retried automatically.
     */
    internal fun req(
        method: String,
        path: String,
        body: Map<String, Any?>? = null,
        query: Map<String, String>? = null,
    ): Any? {
        var url = "$baseUrl$path"
        if (!query.isNullOrEmpty()) {
            url += "?" + query.entries.joinToString("&") { "${it.key}=${qv(it.value)}" }
        }
        val attempts = if (method in IDEMPOTENT) maxAttempts else 1
        var attempt = 1
        while (true) {
            try {
                return once(method, url, body)
            } catch (e: InvisibleDBError) {
                val retryable = e.status == 0 || e.status in RETRYABLE_STATUS
                if (!retryable || attempt >= attempts || method !in IDEMPOTENT) throw e
                Thread.sleep(retryBaseMs * (1L shl (attempt - 1)))
                attempt += 1
            }
        }
    }

    private fun once(method: String, url: String, body: Map<String, Any?>?): Any? {
        val conn = try {
            URL(url).openConnection() as HttpURLConnection
        } catch (e: IOException) {
            throw InvisibleDBError(0, "invalid url", ErrorCode.BAD_REQUEST, cause = e)
        }
        try {
            conn.requestMethod = method
            conn.connectTimeout = timeoutMs
            conn.readTimeout = timeoutMs
            conn.setRequestProperty("Accept", "application/json")
            credential()?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.outputStream.use { it.write(JSONObject(body).toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            val requestId = conn.getHeaderField("X-Request-Id")
            if (status !in 200..299) {
                val (message, data) = parseError(text)
                throw InvisibleDBError(status, message, requestId = requestId, data = data)
            }
            if (status == 204 || text.isEmpty()) return null
            return try {
                parseJson(text)
            } catch (e: JSONException) {
                throw InvisibleDBError(status, "response was not valid JSON", ErrorCode.HTTP_ERROR, requestId, cause = e)
            }
        } catch (e: SocketTimeoutException) {
            throw InvisibleDBError(0, "request timed out after ${timeoutMs}ms", ErrorCode.TIMEOUT, cause = e)
        } catch (e: IOException) {
            throw InvisibleDBError(0, "network request failed", ErrorCode.NETWORK_ERROR, cause = e)
        } finally {
            conn.disconnect()
        }
    }

    private fun parseError(text: String): Pair<String, Any?> {
        return try {
            val obj = JSONObject(text)
            Pair(obj.optString("message", "request failed"), toKotlin(obj.opt("data")))
        } catch (_: JSONException) {
            Pair(if (text.isEmpty()) "request failed" else text.take(300), null)
        }
    }

    private fun parseJson(text: String): Any? {
        val trimmed = text.trimStart()
        return when {
            trimmed.startsWith("{") -> toKotlin(JSONObject(trimmed))
            trimmed.startsWith("[") -> toKotlin(JSONArray(trimmed))
            else -> throw JSONException("expected a JSON object or array")
        }
    }

    /** Sign in as a PocketBase auth collection user. The token is kept for later calls. */
    fun authWithPassword(collection: String, identity: String, password: String): Map<String, Any?> {
        val res = asMap(
            req("POST", "/api/collections/${seg(collection)}/auth-with-password",
                body = mapOf("identity" to identity, "password" to password)),
        )
        userToken = res["token"] as? String
            ?: throw InvisibleDBError(200, "auth response missing token", ErrorCode.HTTP_ERROR)
        return res
    }

    /** Clear the end-user session. */
    fun logout() {
        userToken = null
    }

    /** True if a user session or a server key is set. Anonymous access does not count. */
    fun isAuthenticated(): Boolean = userToken != null || apiKey != null

    fun collection(name: String): RecordCollection = RecordCollection(this, name)

    /** Public file URL for a record's file field. */
    fun fileUrl(collection: String, recordId: String, filename: String): String =
        "$baseUrl/api/files/${seg(collection)}/${seg(recordId)}/${seg(filename)}"

    /** Vector similarity search. */
    fun vectorQuery(collection: String, embedding: List<Double>, limit: Int = 10): List<Map<String, Any?>> {
        val res = asMap(
            req("POST", "/api/vector/query",
                body = mapOf("collection" to collection, "embedding" to embedding, "limit" to limit)),
        )
        @Suppress("UNCHECKED_CAST")
        return (res["results"] as? List<Map<String, Any?>>) ?: emptyList()
    }

    /** Liveness probe. Needs no credentials. */
    fun health(): Map<String, Any?> = asMap(req("GET", "/api/health"))

    /**
     * Call a server procedure (runtime contract v1). Not retried automatically.
     * Procedure names must match `^[a-z][a-z0-9_]{0,63}$`.
     */
    fun rpc(name: String, params: Map<String, Any?> = emptyMap()): Any? {
        validateName(name, "rpc")
        return req("POST", "/api/invisibledb/rpc/${seg(name)}", body = params)
    }

    internal fun invokeFunction(name: String, payload: Map<String, Any?>): Any? {
        validateName(name, "function")
        return req("POST", "/api/invisibledb/functions/${seg(name)}", body = payload)
    }

    private fun validateName(name: String, kind: String) {
        if (!RUNTIME_NAME.matches(name)) {
            throw InvisibleDBError(0, "invalid $kind name: $name", ErrorCode.BAD_REQUEST)
        }
    }
}

/** Server functions: `db.functions.invoke("echo", mapOf(...))`. */
class Functions internal constructor(private val db: InvisibleDB) {
    fun invoke(name: String, payload: Map<String, Any?> = emptyMap()): Any? = db.invokeFunction(name, payload)
}

/** Records of one collection. Named RecordCollection so it does not shadow kotlin.collections.Collection. */
class RecordCollection internal constructor(private val db: InvisibleDB, val name: String) {
    private val path = "/api/collections/${seg(name)}/records"

    fun getList(
        page: Int? = null,
        perPage: Int? = null,
        sort: String? = null,
        filter: String? = null,
        expand: String? = null,
    ): Map<String, Any?> {
        val q = mutableMapOf<String, String>()
        page?.let { q["page"] = it.toString() }
        perPage?.let { q["perPage"] = it.toString() }
        sort?.let { q["sort"] = it }
        filter?.let { q["filter"] = it }
        expand?.let { q["expand"] = it }
        return asMap(db.req("GET", path, query = q))
    }

    fun getOne(id: String): Map<String, Any?> = asMap(db.req("GET", "$path/${seg(id)}"))

    fun create(data: Map<String, Any?>): Map<String, Any?> = asMap(db.req("POST", path, body = data))

    fun update(id: String, data: Map<String, Any?>): Map<String, Any?> =
        asMap(db.req("PATCH", "$path/${seg(id)}", body = data))

    fun delete(id: String) {
        db.req("DELETE", "$path/${seg(id)}")
    }
}
