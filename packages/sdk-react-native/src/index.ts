export interface TokenStore { get(): Promise<string | null>; set(token: string): Promise<void>; clear(): Promise<void>; }
export class MemoryTokenStore implements TokenStore { private value: string | null = null; async get(){return this.value;} async set(v:string){this.value=v;} async clear(){this.value=null;} }
export interface AppStateAdapter { currentState: string; addEventListener(type:'change', listener:(state:string)=>void): { remove(): void }; }
export interface EventSourceLike { onmessage: ((event:{data:string})=>void)|null; onerror: ((event:unknown)=>void)|null; close(): void; }
export type EventSourceFactory = (url:string, init?:{headers?:Record<string,string>}) => EventSourceLike;
export interface InvisibleDBOptions { baseUrl:string; apiKey?:string; tokenStore?:TokenStore; fetchImpl?:typeof fetch; timeoutMs?:number; retries?:number; appState?:AppStateAdapter; eventSourceFactory?:EventSourceFactory; }
export interface ListOptions { page?:number; perPage?:number; sort?:string; filter?:string; expand?:string; }
export interface ListResult<T>{ page:number; perPage:number; totalItems:number; totalPages:number; items:T[]; }
export interface UploadPart { field:string; uri:string; name:string; type:string; }
export class InvisibleDBError extends Error { constructor(public status:number,message:string){ super(`InvisibleDB ${status}: ${message}`); } }
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

export class InvisibleDB {
  readonly baseUrl:string;
  private token:string|null=null;
  private readonly apiKey?:string;
  private readonly tokenStore:TokenStore;
  private readonly fetchImpl:typeof fetch;
  private readonly timeoutMs:number;
  private readonly retries:number;
  private readonly appState?:AppStateAdapter;
  private readonly eventSourceFactory?:EventSourceFactory;

  constructor(o:InvisibleDBOptions){
    if(!o.baseUrl) throw new Error('baseUrl is required');
    this.baseUrl=o.baseUrl.replace(/\/+$/,''); this.apiKey=o.apiKey; this.tokenStore=o.tokenStore??new MemoryTokenStore();
    this.fetchImpl=o.fetchImpl??fetch; this.timeoutMs=o.timeoutMs??15000; this.retries=o.retries??2; this.appState=o.appState; this.eventSourceFactory=o.eventSourceFactory;
  }
  async restoreSession(){ this.token=await this.tokenStore.get(); return this.isAuthenticated; }
  get isAuthenticated(){ return Boolean(this.token||this.apiKey); }
  private async credential(){ if(this.token)return this.token; const t=await this.tokenStore.get(); if(t){this.token=t;return t;} if(this.apiKey)return this.apiKey; return null; }

  async request<T>(method:string,path:string,body?:BodyInit|object,query:Record<string,string>={},multipart=false,authRequired=true):Promise<T>{
    const url=new URL(this.baseUrl+path); Object.entries(query).forEach(([k,v])=>url.searchParams.set(k,v));
    const credential=await this.credential(); if(authRequired&&!credential) throw new InvisibleDBError(401,'authentication required');
    let last:unknown;
    for(let attempt=0;attempt<=this.retries;attempt++){
      const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
      try{
        const headers:Record<string,string>={}; if(credential) headers.authorization=`Bearer ${credential}`;
        let payload:BodyInit|undefined;
        if(body!==undefined){ if(multipart) payload=body as BodyInit; else {headers['content-type']='application/json'; payload=typeof body==='string'?body:JSON.stringify(body);} }
        const res=await this.fetchImpl(url.toString(),{method,headers,body:payload,signal:controller.signal});
        if(res.status===401) throw new InvisibleDBError(401,'invalid credentials');
        if(!res.ok){ const text=(await res.text().catch(()=>res.statusText)).slice(0,300); if((res.status===429||res.status>=500)&&attempt<this.retries){await sleep(250*2**attempt);continue;} throw new InvisibleDBError(res.status,text); }
        if(res.status===204) return undefined as T; return await res.json() as T;
      }catch(e){ last=e; if(e instanceof InvisibleDBError) throw e; if(attempt>=this.retries) throw e; await sleep(250*2**attempt); }
      finally{ clearTimeout(timer); }
    }
    throw last;
  }

  readonly auth={
    withPassword:async(collection:string,identity:string,password:string)=>{
      const r=await this.request<{token:string;record:Record<string,unknown>}>('POST',`/api/collections/${encodeURIComponent(collection)}/auth-with-password`,{identity,password},{},false,false);
      this.token=r.token; await this.tokenStore.set(r.token); return r;
    },
    logout:async()=>{ this.token=null; await this.tokenStore.clear(); }
  };

  collection<T extends Record<string,unknown>=Record<string,unknown>>(name:string){ return new Collection<T>(this,name); }
  fileUrl(c:string,id:string,f:string){return `${this.baseUrl}/api/files/${encodeURIComponent(c)}/${encodeURIComponent(id)}/${encodeURIComponent(f)}`;}
  readonly vector={query:<T=Record<string,unknown>>(collection:string,embedding:number[],limit=10)=>this.request<{results:T[]}>('POST','/api/vector/query',{collection,embedding,limit})};
  health(){return this.request<Record<string,unknown>>('GET','/api/health');}

  async upload<T>(method:'POST'|'PATCH',path:string,fields:Record<string,unknown>,files:UploadPart[]){
    const form=new FormData(); Object.entries(fields).forEach(([k,v])=>form.append(k,typeof v==='string'?v:JSON.stringify(v)));
    files.forEach(f=>form.append(f.field,{uri:f.uri,name:f.name,type:f.type} as unknown as Blob));
    return this.request<T>(method,path,form,{},true,true);
  }

  subscribe<T>(collection:string,callback:(event:{action:string;record:T})=>void){
    if(!this.eventSourceFactory) throw new Error('eventSourceFactory is required for React Native realtime');
    let source:EventSourceLike|null=null, stopped=false; let timer:ReturnType<typeof setTimeout>|null=null;
    const connect=async()=>{
      if(stopped||(this.appState&&this.appState.currentState!=='active')) return;
      const credential=await this.credential(); if(!credential) throw new InvisibleDBError(401,'authentication required');
      const h=await this.request<{clientId:string}>('POST','/api/realtime',{});
      await this.request('POST','/api/realtime',{clientId:h.clientId,subscriptions:[collection]});
      source?.close(); source=this.eventSourceFactory!(`${this.baseUrl}/api/realtime?clientId=${encodeURIComponent(h.clientId)}`,{headers:{authorization:`Bearer ${credential}`}});
      source.onmessage=e=>{try{callback(JSON.parse(e.data));}catch{}};
      source.onerror=()=>{source?.close();if(!stopped)timer=setTimeout(()=>void connect(),1000);};
    };
    const listener=this.appState?.addEventListener('change',s=>{if(s==='active')void connect();else source?.close();});
    void connect(); return()=>{stopped=true;if(timer)clearTimeout(timer);source?.close();listener?.remove();};
  }
}

export class Collection<T extends Record<string,unknown>>{
  constructor(private db:InvisibleDB,public name:string){} private get path(){return `/api/collections/${encodeURIComponent(this.name)}/records`;}
  getList(o:ListOptions={}){const q:Record<string,string>={};if(o.page)q.page=String(o.page);if(o.perPage)q.perPage=String(o.perPage);if(o.sort)q.sort=o.sort;if(o.filter)q.filter=o.filter;if(o.expand)q.expand=o.expand;return this.db.request<ListResult<T>>('GET',this.path,undefined,q);}
  getOne(id:string){return this.db.request<T>('GET',`${this.path}/${encodeURIComponent(id)}`);} create(data:Partial<T>){return this.db.request<T>('POST',this.path,data);} update(id:string,data:Partial<T>){return this.db.request<T>('PATCH',`${this.path}/${encodeURIComponent(id)}`,data);} delete(id:string){return this.db.request<void>('DELETE',`${this.path}/${encodeURIComponent(id)}`);}
  createWithFiles(data:Partial<T>,files:UploadPart[]){return this.db.upload<T>('POST',this.path,data,files);} updateWithFiles(id:string,data:Partial<T>,files:UploadPart[]){return this.db.upload<T>('PATCH',`${this.path}/${encodeURIComponent(id)}`,data,files);} subscribe(cb:(event:{action:string;record:T})=>void){return this.db.subscribe<T>(this.name,cb);}
}
