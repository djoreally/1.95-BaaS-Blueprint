/**
 * InvisibleDB JavaScript / TypeScript SDK.
 *
 * Server/admin mode:
 *   const db = new InvisibleDB({ baseUrl, apiKey: process.env.INVISIBLEDB_KEY });
 *
 * Browser/mobile end-user mode:
 *   const db = new InvisibleDB({ baseUrl });
 *   await db.auth.login('users', email, password);
 *
 * Never ship an `idb_live_...` instance key inside a browser/mobile bundle.
 */

export interface InvisibleDBOptions {
  baseUrl: string;
  /** Privileged server key. Server/trusted runtimes only. */
  apiKey?: string;
  /** Existing PocketBase end-user token, for session restore. */
  authToken?: string;
  /** Override fetch (tests, runtimes without global fetch). */
  fetchImpl?: typeof fetch;
  /** EventSource constructor/polyfill (required for realtime outside browsers). */
  eventSourceImpl?: typeof EventSource;
}

export interface ListOptions {
  page?: number;
  perPage?: number;
  sort?: string;
  filter?: string;
  expand?: string;
}

export interface DbRecord {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  [key: string]: unknown;
}

export interface ListResult<T = DbRecord> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export interface AuthResult<T = DbRecord> {
  token: string;
  record: T;
}

export interface VectorHit<T = DbRecord> {
  id: string;
  distance: number;
  record: T;
}

export class InvisibleDBError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`InvisibleDB ${status}: ${message}`);
    this.status = status;
  }
}

export class InvisibleDB {
  private root: string;
  private apiKey?: string;
  private authToken?: string;
  private fetchImpl: typeof fetch;
  private EventSourceImpl?: typeof EventSource;

  constructor(opts: InvisibleDBOptions) {
    if (!opts.baseUrl) throw new Error('baseUrl is required');
    this.root = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.authToken = opts.authToken;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.EventSourceImpl = opts.eventSourceImpl ?? globalThis.EventSource;
  }

  private credential(): string | undefined {
    return this.authToken || this.apiKey;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const credential = this.credential();
    return { ...extra, ...(credential ? { authorization: `Bearer ${credential}` } : {}) };
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
    credentialMode: 'current' | 'none' = 'current',
  ): Promise<T> {
    const url = new URL(this.root + path);
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const headers: Record<string, string> = body === undefined ? {} : { 'content-type': 'application/json' };
    if (credentialMode === 'current') Object.assign(headers, this.authHeaders());
    const res = await this.fetchImpl(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new InvisibleDBError(res.status, text.slice(0, 300));
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  collection<T = DbRecord>(name: string): Collection<T> {
    return new Collection<T>(this, name);
  }

  api = {
    get: <T>(path: string, query?: Record<string, string>) => this.request<T>('GET', path, undefined, query),
    post: <T>(path: string, body?: unknown) => this.request<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => this.request<T>('PATCH', path, body),
    del: <T>(path: string) => this.request<T>('DELETE', path),
  };

  auth = {
    login: async <T = DbRecord>(collection: string, identity: string, password: string): Promise<AuthResult<T>> => {
      // Login is always public-lane traffic. Never attach an instance server key.
      const result = await this.request<AuthResult<T>>(
        'POST',
        `/api/collections/${collection}/auth-with-password`,
        { identity, password },
        undefined,
        'none',
      );
      this.authToken = result.token;
      return result;
    },
    refresh: async <T = DbRecord>(collection: string): Promise<AuthResult<T>> => {
      if (!this.authToken) throw new Error('no end-user auth token is set');
      const result = await this.request<AuthResult<T>>('POST', `/api/collections/${collection}/auth-refresh`);
      this.authToken = result.token;
      return result;
    },
    setToken: (token?: string) => { this.authToken = token || undefined; },
    getToken: () => this.authToken,
    logout: () => { this.authToken = undefined; },
  };

  fileUrl(collection: string, recordId: string, filename: string): string {
    return `${this.root}/api/files/${collection}/${recordId}/${filename}`;
  }

  vector = {
    upsert: (collection: string, id: string, embedding: number[]) =>
      this.request<{ ok: boolean; dimensions: number }>('POST', '/api/vector/upsert', { collection, id, embedding }),
    remove: (collection: string, id: string) =>
      this.request<{ ok: boolean }>('POST', '/api/vector/delete', { collection, id }),
    query: <T = DbRecord>(collection: string, embedding: number[], limit = 10) =>
      this.request<{ results: VectorHit<T>[]; dimensions: number }>('POST', '/api/vector/query', { collection, embedding, limit }),
    status: () => this.request<{ collections: Array<{ collection: string; dimensions: number }> }>('GET', '/api/vector/status'),
  };

  health = () => this.request<{ message: string; data: Record<string, unknown> }>('GET', '/api/health');

  _internal = {
    root: () => this.root,
    authHeaders: () => this.authHeaders(),
    fetch: () => this.fetchImpl,
    eventSource: () => this.EventSourceImpl,
  };
}

export class Collection<T = DbRecord> {
  constructor(private db: InvisibleDB, private name: string) {}

  getList(opts: ListOptions = {}): Promise<ListResult<T>> {
    const q: Record<string, string> = {};
    if (opts.page) q.page = String(opts.page);
    if (opts.perPage) q.perPage = String(opts.perPage);
    if (opts.sort) q.sort = opts.sort;
    if (opts.filter) q.filter = opts.filter;
    if (opts.expand) q.expand = opts.expand;
    return this.db.api.get<ListResult<T>>(`/api/collections/${this.name}/records`, q);
  }

  getOne(id: string): Promise<T> {
    return this.db.api.get<T>(`/api/collections/${this.name}/records/${id}`);
  }

  create(data: Partial<T>): Promise<T> {
    return this.db.api.post<T>(`/api/collections/${this.name}/records`, data);
  }

  update(id: string, data: Partial<T>): Promise<T> {
    return this.db.api.patch<T>(`/api/collections/${this.name}/records/${id}`, data);
  }

  delete(id: string): Promise<void> {
    return this.db.api.del<void>(`/api/collections/${this.name}/records/${id}`);
  }

  /** PocketBase SSE: GET connection -> PB_CONNECT -> POST subscription list. */
  subscribe(callback: (event: { action: string; record: T }) => void): () => void {
    const root = this.db._internal.root();
    const fetchImpl = this.db._internal.fetch();
    const EventSourceImpl = this.db._internal.eventSource();
    if (!EventSourceImpl) throw new Error('EventSource is unavailable; provide eventSourceImpl in the InvisibleDB constructor');

    const topic = `${this.name}/*`;
    const es = new EventSourceImpl(`${root}/api/realtime`);
    let stopped = false;

    const recordListener = (raw: Event) => {
      try {
        const event = raw as MessageEvent;
        callback(JSON.parse(event.data) as { action: string; record: T });
      } catch { /* ignore malformed/keepalive frames */ }
    };
    es.addEventListener(topic, recordListener as EventListener);

    const connectListener = (raw: Event) => {
      if (stopped) return;
      const event = raw as MessageEvent;
      const clientId = event.lastEventId;
      if (!clientId) return;
      void fetchImpl(`${root}/api/realtime`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.db._internal.authHeaders() },
        body: JSON.stringify({ clientId, subscriptions: [topic] }),
      }).then((response) => {
        if (!response.ok) throw new Error(`realtime subscription failed (${response.status})`);
      }).catch(() => { /* EventSource reconnect will produce another PB_CONNECT */ });
    };
    es.addEventListener('PB_CONNECT', connectListener as EventListener);

    return () => {
      stopped = true;
      es.removeEventListener(topic, recordListener as EventListener);
      es.removeEventListener('PB_CONNECT', connectListener as EventListener);
      es.close();
    };
  }
}
