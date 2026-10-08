package invisibledb

import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import org.json.JSONArray

/**
 * InvisibleDB Kotlin SDK for Android.
 *
 * Two auth modes:
 * - API key (server-side only): full instance access. NEVER ship in app bundles.
 * - User auth (client-safe): authenticate as a PocketBase user, scoped by collection rules.
 *
 * ```kotlin
 * // Server-side (e.g., in your backend)
 * val db = InvisibleDB(baseUrl = "https://acme.invisibledb.app", apiKey = System.getenv("INVISIBLED_KEY"))
 *
 * // Client-side (in your Android app)
 * val db = InvisibleDB(baseUrl = "https://acme.invisibledb.app")
 * db.authWithPassword("users", "user@example.com", "password")
 * ```
 */
class InvisibleDBError(val status: Int, message: String) : Exception("InvisibleDB $status: $message")

class InvisibleDB(
    baseUrl: String,
    private val apiKey: String? = null
) {
    val baseUrl: String = baseUrl.trimEnd('/')
    private var userToken: String? = null

    private fun authHeader(): String {
        // User token takes precedence (client-safe). API key is server-side fallback.
        userToken?.let { return "Bearer $it" }
        apiKey?.let { return "Bearer $it" }
        throw InvisibleDBError(401, "no credentials: provide apiKey or call authWithPassword first")
    }

    @Suppress("UNCHECKED_CAST")
    internal fun <T> req(method: String, path: String, body: Map<String, Any?>? = null, query: Map<String, String>? = null): T {
        var urlStr = "$baseUrl$path"
        if (!query.isNullOrEmpty()) {
            val qs = query.entries.joinToString("&") { "${it.key}=${it.value}" }
            urlStr += "?$qs"
        }
        val conn = URL(urlStr).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", authHeader())
        if (body != null) {
            conn.doOutput = true
            conn.outputStream.use { it.write(JSONObject(body as Map<String, *>).toString().toByteArray()) }
        }
        val code = conn.responseCode
        if (code == 401) throw InvisibleDBError(401, "invalid credentials")
        if (code < 200 || code >= 300) {
            val errBody = try { conn.errorStream?.bufferedReader()?.readText()?.take(300) } catch (_: Exception) { null }
            throw InvisibleDBError(code, errBody ?: "request failed")
        }
        if (code == 204) return Unit as T
        val respBody = conn.inputStream.bufferedReader().readText()
        if (respBody.isEmpty()) return Unit as T
        return JSONObject(respBody) as T
    }

    /**
     * Authenticate as a PocketBase user (client-safe).
     * The token is scoped by the collection's API rules.
     */
    fun authWithPassword(collection: String, identity: String, password: String): Map<String, Any> {
        val res: Map<String, Any> = req("POST", "/api/collections/$collection/auth-with-password",
            body = mapOf("identity" to identity, "password" to password))
        @Suppress("UNCHECKED_CAST")
        userToken = res["token"] as? String
            ?: throw InvisibleDBError(500, "auth response missing token")
        return res
    }

    /** Clear the user session. */
    fun logout() { userToken = null }

    /** True if authenticated via user token or API key. */
    fun isAuthenticated(): Boolean = userToken != null || apiKey != null

    fun collection(name: String): Collection = Collection(this, name)

    /** File URL for a record's file field. */
    fun fileUrl(collection: String, recordId: String, filename: String): String =
        "$baseUrl/api/files/$collection/$recordId/$filename"

    /** Semantic vector search. */
    fun vectorQuery(collection: String, embedding: List<Double>, limit: Int = 10): List<Map<String, Any>> {
        val res: Map<String, Any> = req("POST", "/api/vector/query",
            body = mapOf("collection" to collection, "embedding" to embedding, "limit" to limit))
        @Suppress("UNCHECKED_CAST")
        return (res["results"] as? List<Map<String, Any>>) ?: emptyList()
    }

    /** Liveness probe. */
    fun health(): Map<String, Any> = req("GET", "/api/health")
}

class Collection(private val db: InvisibleDB, val name: String) {
    private val path = "/api/collections/$name/records"

    fun getList(page: Int? = null, perPage: Int? = null, sort: String? = null,
                filter: String? = null, expand: String? = null): Map<String, Any> {
        val q = mutableMapOf<String, String>()
        page?.let { q["page"] = it.toString() }
        perPage?.let { q["perPage"] = it.toString() }
        sort?.let { q["sort"] = it }
        filter?.let { q["filter"] = it }
        expand?.let { q["expand"] = it }
        return db.req("GET", path, query = q)
    }

    fun getOne(id: String): Map<String, Any> = db.req("GET", "$path/$id")

    fun create(data: Map<String, Any?>): Map<String, Any> =
        db.req("POST", path, body = data)

    fun update(id: String, data: Map<String, Any?>): Map<String, Any> =
        db.req("PATCH", "$path/$id", body = data)

    fun delete(id: String) { db.req<Unit>("DELETE", "$path/$id") }
}
