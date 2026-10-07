/**
 * InvisibleDB JavaScript SDK.
 *
 *   import { InvisibleDB } from 'invisibledb';
 *   const db = new InvisibleDB({ baseUrl: 'https://acme.invisibledb.app', apiKey: process.env.INVISIBLEDB_KEY });
 *   const messages = await db.collection('messages').getList();
 *
 * The apiKey is the single customer key. It travels as
 * `Authorization: Bearer <key>`; the gateway validates it and swaps in the
 * instance credential. Never ship the key in client bundles you don't control.
 */

export interface InvisibleDBOptions {
  baseUrl: string;
  apiKey: string;
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

export class InvisibleDBError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`InvisibleDB ${status}: ${message}`);
    this.status = status;
  }
}

export class InvisibleDB {
  private root: string;
  private apiKey: string;
  private fetchImpl: typeof fetch;

  constructor(opts: InvisibleDBOptions) {
    if (!opts.baseUrl || !opts.apiKey) throw new Error('baseUrl and apiKey are required');
    this.root = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async req<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(this.root + path);
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url.toString(), {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) throw new InvisibleDBError(401, 'invalid api key');
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

  /** Raw escape hatch: GET/POST/DELETE against any API path. */
  api = {
    get: <T>(path: string, query?: Record<string, string>) => this.req<T>('GET', path, undefined, query),
    post: <T>(path: string, body?: unknown) => this.req<T>('POST', path, body),
    del: <T>(path: string) => this.req<T>('DELETE', path),
  };

  /** File URL for a record's file field (no fetch — use in <img src> etc.). */
  fileUrl(collection: string, recordId: string, filename: string): string {
    return `${this.root}/api/files/${collection}/${recordId}/${filename}`;
  }

  /** Semantic vector search (requires the :vec PocketBase build). */
  vector = {
    query: <T = DbRecord>(collection: string, embedding: number[], limit = 10) =>
      this.req<{ results: T[] }>('POST', '/api/vector/query', { collection, embedding, limit }),
  };

  /** Liveness probe for your instance. */
  health = () => this.req<{ message: string; data: Record<string, unknown> }>('GET', '/api/health');
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
    return this.db.api.post<T>(`/api/collections/${this.name}/records/${id}`, data);
  }

  delete(id: string): Promise<void> {
    return this.db.api.del<void>(`/api/collections/${this.name}/records/${id}`);
  }

  /**
   * Realtime subscription via PocketBase SSE.
   * Returns an unsubscribe function. Requires an environment with EventSource.
   */
  subscribe(callback: (event: { action: string; record: T }) => void): () => void {
    const root = (this.db as unknown as { root: string }).root;
    const key = (this.db as unknown as { apiKey: string }).apiKey;
    let es: EventSource | null = null;
    let stopped = false;

    const connect = async () => {
      // PocketBase realtime handshake: get a clientId, then subscribe.
      const res = await fetch(`${root}/api/realtime`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
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
      // Tell the server which collection we want events for.
      await fetch(`${root}/api/realtime`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
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
