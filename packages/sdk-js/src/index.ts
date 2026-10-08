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

  constructor(opts: InvisibleDBOptions) {
    if (!opts.baseUrl) throw new Error('baseUrl is required');
    this.root = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.authToken = opts.authToken;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private credential(): string | undefined {
    // End-user sessions take precedence when explicitly set. Server code normally
    // uses only apiKey; client code uses only authToken.
    return this.authToken || this.apiKey;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const credential = this.credential();
    return {
      ...extra,
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
    };
  }

  private async req<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(this.root + path);
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url.toString(), {
      method,
      headers: this.authHeaders(body === undefined ? {} : { 'content-type': 'application/json' }),
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
    get: <T>(path: string, query?: Record<string, string>) => this.req<T>('GET', path, undefined, query),
    post: <T>(path: string, body?: unknown) => this.req<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => this.req<T>('PATCH', path, body),
    del: <T>(path: string) => this.req<T>('DELETE', path),
  };

  /** End-user authentication. No instance server key is required. */
  auth = {
    login: async <T = DbRecord>(collection: string, identity: string, password: string): Promise<AuthResult<T>> => {
      // Login must not accidentally elevate through the server key. A client app
      // should be constructed without apiKey; temporarily omit any old user token.
      const previous = this.authToken;
      this.authToken = undefined;
      try {
        const result = await this.req<AuthResult<T>>(
          'POST',
          `/api/collections/${collection}/auth-with-password`,
          { identity, password },
        );
        this.authToken = result.token;
        return result;
      } catch (error) {
        this.authToken = previous;
        throw error;
      }
    },
    refresh: async <T = DbRecord>(collection: string): Promise<AuthResult<T>> => {
      if (!this.authToken) throw new Error('no end-user auth token is set');
      const result = await this.req<AuthResult<T>>('POST', `/api/collections/${collection}/auth-refresh`);
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
    query: <T = DbRecord>(collection: string, embedding: number[], limit = 10) =>
      this.req<{ results: T[] }>('POST', '/api/vector/query', { collection, embedding, limit }),
  };

  health = () => this.req<{ message: string; data: Record<string, unknown> }>('GET', '/api/health');

  /** Internal helpers used by Collection without exposing credentials publicly. */
  _internal = {
    root: () => this.root,
    authHeaders: () => this.authHeaders(),
    fetch: () => this.fetchImpl,
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

  subscribe(callback: (event: { action: string; record: T }) => void): () => void {
    const root = this.db._internal.root();
    const fetchImpl = this.db._internal.fetch();
    let es: EventSource | null = null;
    let stopped = false;

    const connect = async () => {
      const res = await fetchImpl(`${root}/api/realtime`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.db._internal.authHeaders() },
      });
      if (!res.ok || stopped) return;
      const { clientId } = (await res.json()) as { clientId: string };
      es = new EventSource(`${root}/api/realtime?clientId=${clientId}`);
      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as { action: string; record: T };
          callback(data);
        } catch { /* keep-alive frames */ }
      };
      await fetchImpl(`${root}/api/realtime`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.db._internal.authHeaders() },
        body: JSON.stringify({ clientId, subscriptions: [this.name] }),
      }).catch(() => {});
    };
    connect().catch(() => {});

    return () => {
      stopped = true;
      es?.close();
    };
  }
}
