package invisibledb

import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.pow

interface TokenStore {
    suspend fun get(): String?
    suspend fun set(token: String)
    suspend fun clear()
}

class MemoryTokenStore : TokenStore {
    private var token: String? = null
    override suspend fun get() = token
    override suspend fun set(token: String) { this.token = token }
    override suspend fun clear() { token = null }
}

class InvisibleDBError(val status: Int, message: String) : Exception("InvisibleDB $status: $message")

data class ListOptions(
    val page: Int? = null,
    val perPage: Int? = null,
    val sort: String? = null,
    val filter: String? = null,
    val expand: String? = null,
)

data class UploadPart(val field: String, val file: File, val contentType: String)

class InvisibleDB(
    baseUrl: String,
    private val apiKey: String? = null,
    private val tokenStore: TokenStore = MemoryTokenStore(),
    timeoutSeconds: Long = 15,
    private val retries: Int = 2,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .build(),
) {
    val baseUrl = baseUrl.trimEnd('/')
    private val json = Json { ignoreUnknownKeys = true }
    @Volatile private var userToken: String? = null

    suspend fun restoreSession(): Boolean {
        userToken = tokenStore.get()
        return isAuthenticated()
    }

    fun isAuthenticated() = userToken != null || apiKey != null

    private suspend fun credential(): String {
        userToken?.let { return it }
        tokenStore.get()?.let { userToken = it; return it }
        apiKey?.let { return it }
        throw InvisibleDBError(401, "no credentials; authenticate a user or provide a server-side API key")
    }

    private suspend fun execute(request: Request): Response = suspendCancellableCoroutine { cont ->
        val call = client.newCall(request)
        cont.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) { if (cont.isActive) cont.resumeWithException(e) }
            override fun onResponse(call: Call, response: Response) { if (cont.isActive) cont.resume(response) else response.close() }
        })
    }

    internal suspend fun request(
        method: String,
        path: String,
        body: RequestBody? = null,
        query: Map<String, String> = emptyMap(),
    ): JsonElement {
        val urlBuilder = (baseUrl + path).toHttpUrl().newBuilder()
        query.forEach { (k, v) -> urlBuilder.addQueryParameter(k, v) }
        var last: Throwable? = null
        for (attempt in 0..retries) {
            val request = Request.Builder()
                .url(urlBuilder.build())
                .header("Authorization", "Bearer ${credential()}")
                .method(method, if (method == "GET" || method == "DELETE") null else body ?: ByteArray(0).toRequestBody())
                .build()
            try {
                execute(request).use { response ->
                    if (response.code == 401) throw InvisibleDBError(401, "invalid credentials")
                    if (!response.isSuccessful) {
                        val msg = response.body?.string()?.take(300) ?: "request failed"
                        if ((response.code == 429 || response.code >= 500) && attempt < retries) {
                            delay((250.0 * 2.0.pow(attempt)).toLong())
                            return@use
                        }
                        throw InvisibleDBError(response.code, msg)
                    }
                    val text = response.body?.string().orEmpty()
                    return if (text.isBlank()) JsonNull else json.parseToJsonElement(text)
                }
            } catch (e: Throwable) {
                last = e
                if (e is InvisibleDBError) throw e
                if (attempt >= retries) throw e
                delay((250.0 * 2.0.pow(attempt)).toLong())
            }
        }
        throw last ?: IllegalStateException("request failed")
    }

    suspend fun authWithPassword(collection: String, identity: String, password: String): JsonObject {
        val payload = buildJsonObject { put("identity", identity); put("password", password) }
        val result = request(
            "POST",
            "/api/collections/$collection/auth-with-password",
            payload.toString().toRequestBody("application/json".toMediaType()),
        ).jsonObject
        val token = result["token"]?.jsonPrimitive?.content
            ?: throw InvisibleDBError(500, "auth response missing token")
        userToken = token
        tokenStore.set(token)
        return result
    }

    suspend fun logout() { userToken = null; tokenStore.clear() }

    fun collection(name: String) = Collection(this, name)

    fun fileUrl(collection: String, recordId: String, filename: String) =
        "$baseUrl/api/files/$collection/$recordId/$filename"

    suspend fun vectorQuery(collection: String, embedding: List<Double>, limit: Int = 10): JsonArray {
        val payload = buildJsonObject {
            put("collection", collection)
            put("embedding", JsonArray(embedding.map(::JsonPrimitive)))
            put("limit", limit)
        }
        return request("POST", "/api/vector/query", payload.toString().toRequestBody("application/json".toMediaType()))
            .jsonObject["results"]?.jsonArray ?: JsonArray(emptyList())
    }

    suspend fun health() = request("GET", "/api/health").jsonObject

    suspend fun upload(method: String, path: String, fields: JsonObject, files: List<UploadPart>): JsonElement {
        val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
        fields.forEach { (k, v) -> multipart.addFormDataPart(k, if (v is JsonPrimitive && v.isString) v.content else v.toString()) }
        files.forEach { part ->
            multipart.addFormDataPart(part.field, part.file.name, part.file.asRequestBody(part.contentType.toMediaType()))
        }
        return request(method, path, multipart.build())
    }

    suspend fun subscribe(collection: String, onEvent: (JsonObject) -> Unit): Subscription {
        val handshake = request("POST", "/api/realtime", ByteArray(0).toRequestBody()).jsonObject
        val clientId = handshake["clientId"]?.jsonPrimitive?.content
            ?: throw InvisibleDBError(500, "realtime handshake missing clientId")
        val subPayload = buildJsonObject {
            put("clientId", clientId)
            put("subscriptions", JsonArray(listOf(JsonPrimitive(collection))))
        }
        request("POST", "/api/realtime", subPayload.toString().toRequestBody("application/json".toMediaType()))
        val req = Request.Builder()
            .url("$baseUrl/api/realtime?clientId=$clientId")
            .header("Authorization", "Bearer ${credential()}")
            .build()
        val source = EventSources.createFactory(client).newEventSource(req, object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                runCatching { json.parseToJsonElement(data).jsonObject }.getOrNull()?.let(onEvent)
            }
        })
        return Subscription(source)
    }
}

class Subscription(private val source: EventSource) : AutoCloseable {
    override fun close() { source.cancel() }
}

class Collection(private val db: InvisibleDB, val name: String) {
    private val path get() = "/api/collections/$name/records"

    suspend fun getList(options: ListOptions = ListOptions()): JsonObject {
        val q = buildMap {
            options.page?.let { put("page", it.toString()) }
            options.perPage?.let { put("perPage", it.toString()) }
            options.sort?.let { put("sort", it) }
            options.filter?.let { put("filter", it) }
            options.expand?.let { put("expand", it) }
        }
        return db.request("GET", path, query = q).jsonObject
    }

    suspend fun getOne(id: String) = db.request("GET", "$path/$id").jsonObject
    suspend fun create(data: JsonObject) = db.request("POST", path, data.toString().toRequestBody("application/json".toMediaType())).jsonObject
    suspend fun update(id: String, data: JsonObject) = db.request("PATCH", "$path/$id", data.toString().toRequestBody("application/json".toMediaType())).jsonObject
    suspend fun delete(id: String) { db.request("DELETE", "$path/$id") }
    suspend fun createWithFiles(data: JsonObject, files: List<UploadPart>) = db.upload("POST", path, data, files).jsonObject
    suspend fun updateWithFiles(id: String, data: JsonObject, files: List<UploadPart>) = db.upload("PATCH", "$path/$id", data, files).jsonObject
    suspend fun subscribe(onEvent: (JsonObject) -> Unit) = db.subscribe(name, onEvent)
}
