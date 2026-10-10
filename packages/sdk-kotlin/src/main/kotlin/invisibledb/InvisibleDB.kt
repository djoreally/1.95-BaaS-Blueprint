package invisibledb

import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.HttpUrl.Companion.toHttpUrl
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

interface TokenStore { suspend fun get():String?; suspend fun set(token:String); suspend fun clear() }
class MemoryTokenStore:TokenStore { private var token:String?=null; override suspend fun get()=token; override suspend fun set(token:String){this.token=token}; override suspend fun clear(){token=null} }
class InvisibleDBError(val status:Int,message:String):Exception("InvisibleDB $status: $message")
data class ListOptions(val page:Int?=null,val perPage:Int?=null,val sort:String?=null,val filter:String?=null,val expand:String?=null)
data class UploadPart(val field:String,val file:File,val contentType:String)

class InvisibleDB(
    baseUrl:String,
    private val apiKey:String?=null,
    private val tokenStore:TokenStore=MemoryTokenStore(),
    timeoutSeconds:Long=15,
    private val retries:Int=2,
    private val client:OkHttpClient=OkHttpClient.Builder().connectTimeout(timeoutSeconds,TimeUnit.SECONDS).readTimeout(timeoutSeconds,TimeUnit.SECONDS).writeTimeout(timeoutSeconds,TimeUnit.SECONDS).build()
){
    val baseUrl=baseUrl.trimEnd('/'); private val json=Json{ignoreUnknownKeys=true}; @Volatile private var userToken:String?=null
    suspend fun restoreSession():Boolean{userToken=tokenStore.get();return isAuthenticated()}; fun isAuthenticated()=userToken!=null||apiKey!=null
    private suspend fun credential():String?{userToken?.let{return it};tokenStore.get()?.let{userToken=it;return it};return apiKey}
    private suspend fun execute(req:Request):Response=suspendCancellableCoroutine{c->val call=client.newCall(req);c.invokeOnCancellation{call.cancel()};call.enqueue(object:Callback{override fun onFailure(call:Call,e:IOException){if(c.isActive)c.resumeWithException(e)};override fun onResponse(call:Call,response:Response){if(c.isActive)c.resume(response)else response.close()}})}

    internal suspend fun request(method:String,path:String,body:RequestBody?=null,query:Map<String,String> = emptyMap(),authRequired:Boolean=true):JsonElement{
        val ub=(baseUrl+path).toHttpUrl().newBuilder();query.forEach{(k,v)->ub.addQueryParameter(k,v)};var last:Throwable?=null
        for(attempt in 0..retries){
            val credential=credential();if(authRequired&&credential==null)throw InvisibleDBError(401,"authentication required")
            val rb=Request.Builder().url(ub.build());if(credential!=null)rb.header("Authorization","Bearer $credential");val req=rb.method(method,if(method=="GET"||method=="DELETE")null else body?:ByteArray(0).toRequestBody()).build()
            try{execute(req).use{r->if(r.code==401)throw InvisibleDBError(401,"invalid credentials");if(!r.isSuccessful){val msg=r.body?.string()?.take(300)?:"request failed";if((r.code==429||r.code>=500)&&attempt<retries){delay(250L*(1L shl attempt));return@use};throw InvisibleDBError(r.code,msg)};val t=r.body?.string().orEmpty();return if(t.isBlank())JsonNull else json.parseToJsonElement(t)}}catch(e:Throwable){last=e;if(e is InvisibleDBError)throw e;if(attempt>=retries)throw e;delay(250L*(1L shl attempt))}
        };throw last?:IllegalStateException("request failed")
    }

    suspend fun authWithPassword(collection:String,identity:String,password:String):JsonObject{
        val p=buildJsonObject{put("identity",identity);put("password",password)}
        val r=request("POST","/api/collections/$collection/auth-with-password",p.toString().toRequestBody("application/json".toMediaType()),authRequired=false).jsonObject
        val t=r["token"]?.jsonPrimitive?.content?:throw InvisibleDBError(500,"auth response missing token");userToken=t;tokenStore.set(t);return r
    }
    suspend fun logout(){userToken=null;tokenStore.clear()};fun collection(name:String)=Collection(this,name)
    fun fileUrl(c:String,id:String,f:String)="$baseUrl/api/files/$c/$id/$f"
    suspend fun vectorQuery(c:String,e:List<Double>,limit:Int=10):JsonArray{val p=buildJsonObject{put("collection",c);put("embedding",JsonArray(e.map(::JsonPrimitive)));put("limit",limit)};return request("POST","/api/vector/query",p.toString().toRequestBody("application/json".toMediaType())).jsonObject["results"]?.jsonArray?:JsonArray(emptyList())}
    suspend fun health()=request("GET","/api/health").jsonObject
    suspend fun upload(method:String,path:String,fields:JsonObject,files:List<UploadPart>):JsonElement{val m=MultipartBody.Builder().setType(MultipartBody.FORM);fields.forEach{(k,v)->m.addFormDataPart(k,if(v is JsonPrimitive&&v.isString)v.content else v.toString())};files.forEach{p->m.addFormDataPart(p.field,p.file.name,p.file.asRequestBody(p.contentType.toMediaType()))};return request(method,path,m.build())}
    suspend fun subscribe(collection:String,onEvent:(JsonObject)->Unit):Subscription{val h=request("POST","/api/realtime",ByteArray(0).toRequestBody()).jsonObject;val id=h["clientId"]?.jsonPrimitive?.content?:throw InvisibleDBError(500,"realtime handshake missing clientId");val p=buildJsonObject{put("clientId",id);put("subscriptions",JsonArray(listOf(JsonPrimitive(collection))))};request("POST","/api/realtime",p.toString().toRequestBody("application/json".toMediaType()));val credential=credential()?:throw InvisibleDBError(401,"authentication required");val req=Request.Builder().url("$baseUrl/api/realtime?clientId=$id").header("Authorization","Bearer $credential").build();val src=EventSources.createFactory(client).newEventSource(req,object:EventSourceListener(){override fun onEvent(eventSource:EventSource,id:String?,type:String?,data:String){runCatching{json.parseToJsonElement(data).jsonObject}.getOrNull()?.let(onEvent)}});return Subscription(src)}
}
class Subscription(private val source:EventSource):AutoCloseable{override fun close(){source.cancel()}}
class Collection(private val db:InvisibleDB,val name:String){private val path get()="/api/collections/$name/records";suspend fun getList(o:ListOptions=ListOptions()):JsonObject{val q=buildMap{if(o.page!=null)put("page",o.page.toString());if(o.perPage!=null)put("perPage",o.perPage.toString());o.sort?.let{put("sort",it)};o.filter?.let{put("filter",it)};o.expand?.let{put("expand",it)}};return db.request("GET",path,query=q).jsonObject};suspend fun getOne(id:String)=db.request("GET","$path/$id").jsonObject;suspend fun create(d:JsonObject)=db.request("POST",path,d.toString().toRequestBody("application/json".toMediaType())).jsonObject;suspend fun update(id:String,d:JsonObject)=db.request("PATCH","$path/$id",d.toString().toRequestBody("application/json".toMediaType())).jsonObject;suspend fun delete(id:String){db.request("DELETE","$path/$id")};suspend fun createWithFiles(d:JsonObject,f:List<UploadPart>)=db.upload("POST",path,d,f).jsonObject;suspend fun updateWithFiles(id:String,d:JsonObject,f:List<UploadPart>)=db.upload("PATCH","$path/$id",d,f).jsonObject;suspend fun subscribe(cb:(JsonObject)->Unit)=db.subscribe(name,cb)}
