export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  private token: string | null = null;
  async get() { return this.token; }
  async set(token: string) { this.token = token; }
  async clear() { this.token = null; }
}

export interface AppStateAdapter {
  currentState: string;
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

export interface EventSourceLike {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(): void;
}

export type EventSourceFactory = (url: string, init?: { headers?: Record<string, string> }) => EventSourceLike;

export interface InvisibleDBOptions {
  baseUrl: string;
  apiKey?: string;
  tokenStore?: TokenStore;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  appState?: AppStateAdapter;
  eventSourceFactory?: EventSourceFactory;
}

export interface ListOptions {
  page?: number;
  perPage?: number;
  sort?: string;
  filter?: string;
  expand?: string;
}

export interface ListResult<T = Record<string, unknown>> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export interface UploadPart {
  field: string;
  uri: string;
  name: string;
  type: string;
}

export class InvisibleDBError extends Error {
  constructor(public status: number, message: string) {
    super(`InvisibleDB ${status}: ${message}`);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class InvisibleDB {
  readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly tokenStore: TokenStore;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly appState?: AppStateAdapter;
  private readonly eventSourceFactory?: EventSourceFactory;
  private token: string | null = null;

  constructor(options: InvisibleDBOptions) {
    if (!options.baseUrl) throw new Error('baseUrl is required');
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.tokenStore = options.tokenStore ?? new MemoryTokenStore();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.retries = options.retries ?? 2;
    this.appState = options.appState;
    this.eventSourceFactory = options.eventSourceFactory;
  }

  async restoreSession(): Promise<boolean> {
    this.token = await this.tokenStore.get();
    return this.isAuthenticated;
  }

  get isAuthenticated() { return Boolean(this.token || this.apiKey); }

  private async credential(): Promise<string> {
    if (this.token) return this.token;
    const restored = await this.tokenStore.get();
    if (restored) {
      this.token = restored;
      return restored;
    }
    if (this.apiKey) return this.apiKey;
    throw new InvisibleDBError(401, 'no credentials; authenticate a user or provide a server-side API key');
  }

  private async request<T>(method: string, path: string, body?: BodyInit | object, query?: Record<string, string>, multipart = false): Promise<T> {
    const url = new URL(this.baseUrl + path);
    Object.entries(query ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const credential = await this.credential();

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = { authorization: `Bearer ${credential}` };
        let payload: BodyInit | undefined;
        if (body !== undefined) {
          if (multipart) payload = body as BodyInit;
          else {
            headers['content-type'] = 'application/json';
            payload = typeof body === 'string' ? body : JSON.stringify(body);
          }
        }
        const response = await this.fetchImpl(url.toString(), { method, headers, body: payload, signal: controller.signal });
        if (response.status === 401) throw new InvisibleDBError(401, 'invalid credentials');
        if (!response.ok) {
          const text = (await response.text().catch(() => response.statusText)).slice(0, 300);
          if ((response.status === 429 || response.status >= 500) && attempt < this.retries) {
            await sleep(250 * 2 ** attempt);
            continue;
          }
          throw new InvisibleDBError(response.status, text);
        }
        if (response.status === 204) return undefined as T;
        return await response.json() as T;
      } catch (error) {
        lastError = error;
        if (error instanceof InvisibleDBError) throw error;
        if (attempt >= this.retries) throw error;
        await sleep(250 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  readonly auth = {
    withPassword: async (collection: string, identity: string, password: string) => {
      const result = await this.request<{ token: string; record: Record<string, unknown> }>(
        'POST', `/api/collections/${encodeURIComponent(collection)}/auth-with-password`, { identity, password }
      );
      this.token = result.token;
      await this.tokenStore.set(result.token);
      return result;
    },
    logout: async () => {
      this.token = null;
      await this.tokenStore.clear();
    },
  };

  collection<T extends Record<string, unknown> = Record<string, unknown>>(name: string) {
    return new Collection<T>(this, name);
  }

  fileUrl(collection: string, recordId: string, filename: string) {
    return `${this.baseUrl}/api/files/${encodeURIComponent(collection)}/${encodeURIComponent(recordId)}/${encodeURIComponent(filename)}`;
  }

  readonly vector = {
    query: <T = Record<string, unknown>>(collection: string, embedding: number[], limit = 10) =>
      this.request<{ results: T[] }>('POST', '/api/vector/query', { collection, embedding, limit }),
  };

  health() { return this.request<Record<string, unknown>>('GET', '/api/health'); }

  async upload<T>(method: 'POST' | 'PATCH', path: string, fields: Record<string, unknown>, files: UploadPart[]): Promise<T> {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, typeof value === 'string' ? value : JSON.stringify(value)));
    for (const file of files) {
      form.append(file.field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    }
    return this.request<T>(method, path, form, undefined, true);
  }

  subscribe<T>(collection: string, callback: (event: { action: string; record: T }) => void): () => void {
    if (!this.eventSourceFactory) {
      throw new Error('Realtime requires eventSourceFactory (for example a React Native SSE implementation).');
    }
    let source: EventSourceLike | null = null;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      if (stopped || (this.appState && this.appState.currentState !== 'active')) return;
      const credential = await this.credential();
      const handshake = await this.request<{ clientId: string }>('POST', '/api/realtime', {});
      await this.request('POST', '/api/realtime', { clientId: handshake.clientId, subscriptions: [collection] });
      source?.close();
      source = this.eventSourceFactory!(`${this.baseUrl}/api/realtime?clientId=${encodeURIComponent(handshake.clientId)}`, {
        headers: { authorization: `Bearer ${credential}` },
      });
      source.onmessage = (event) => {
        try { callback(JSON.parse(event.data)); } catch { /* heartbeat */ }
      };
      source.onerror = () => {
        source?.close();
        if (!stopped) reconnectTimer = setTimeout(() => void connect(), 1000);
      };
    };

    const appListener = this.appState?.addEventListener('change', (state) => {
      if (state === 'active') void connect();
      else source?.close();
    });

    void connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      source?.close();
      appListener?.remove();
    };
  }
}

export class Collection<T extends Record<string, unknown>> {
  constructor(private readonly db: InvisibleDB, public readonly name: string) {}
  private get path() { return `/api/collections/${encodeURIComponent(this.name)}/records`; }

  getList(options: ListOptions = {}) {
    const query: Record<string, string> = {};
    if (options.page) query.page = String(options.page);
    if (options.perPage) query.perPage = String(options.perPage);
    if (options.sort) query.sort = options.sort;
    if (options.filter) query.filter = options.filter;
    if (options.expand) query.expand = options.expand;
    return this.db['request']<ListResult<T>>('GET', this.path, undefined, query);
  }
  getOne(id: string) { return this.db['request']<T>('GET', `${this.path}/${encodeURIComponent(id)}`); }
  create(data: Partial<T>) { return this.db['request']<T>('POST', this.path, data); }
  update(id: string, data: Partial<T>) { return this.db['request']<T>('PATCH', `${this.path}/${encodeURIComponent(id)}`, data); }
  delete(id: string) { return this.db['request']<void>('DELETE', `${this.path}/${encodeURIComponent(id)}`); }
  createWithFiles(data: Partial<T>, files: UploadPart[]) { return this.db.upload<T>('POST', this.path, data, files); }
  updateWithFiles(id: string, data: Partial<T>, files: UploadPart[]) { return this.db.upload<T>('PATCH', `${this.path}/${encodeURIComponent(id)}`, data, files); }
  subscribe(callback: (event: { action: string; record: T }) => void) { return this.db.subscribe<T>(this.name, callback); }
}
