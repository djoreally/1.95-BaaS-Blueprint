/**
 * InvisibleDB JavaScript / TypeScript SDK — the reference implementation.
 *
 * Every other official SDK (Swift, Kotlin, Dart, PHP, Python, Go) must expose the
 * same conceptual surface and pass the same conformance scenarios
 * (docs/19-sdk-matrix.md). This file defines that surface.
 *
 * Trusted server / admin lane (Next.js route handlers, Node, Laravel, ...):
 *   const idb = createClient({ url: process.env.IDB_URL!, apiKey: process.env.IDB_KEY });
 *
 * Client lane (browser, React Native, Expo, anything shipped to end users):
 *   const idb = createClient({ url: process.env.NEXT_PUBLIC_IDB_URL! });
 *   await idb.auth.signIn({ email, password });
 *
 * Never ship an `idb_live_...` instance key inside a browser or mobile bundle.
 */

export interface InvisibleDBOptions {
  /** Instance base URL, e.g. https://acme.invisibledb.app. `url` is an alias for `baseUrl`. */
  baseUrl?: string;
  url?: string;
  /** Privileged instance key. Trusted server runtimes only. */
  apiKey?: string;
  /** Existing end-user token, for session restore. */
  authToken?: string;
  /** Auth collection used by auth.signIn / signUp / password flows. Default: "users". */
  authCollection?: string;
  /** Override fetch (tests, runtimes without global fetch). */
  fetchImpl?: typeof fetch;
  /** EventSource constructor/polyfill (realtime outside browsers without a global EventSource). */
  eventSourceImpl?: typeof EventSource;
  /** Per-attempt timeout in milliseconds. Default 30000. */
  timeoutMs?: number;
  /**
   * Retry policy for idempotent requests (GET, HEAD, PUT, DELETE) only.
   * Retries network errors and 429/502/503/504 with capped exponential backoff and jitter.
   * Non-idempotent calls (POST, PATCH, rpc, functions) are never retried automatically.
   * Pass `false` to disable.
   */
  retry?: false | RetryOptions;
}

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number;
  /** Base delay for exponential backoff. Default 250. */
  baseDelayMs?: number;
  /** Upper bound for any single delay. Default 4000. */
  maxDelayMs?: number;
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
  /** Present only when the collection defines the autodate field. */
  created?: string;
  updated?: string;
  [key: string]: unknown;
}

/** Canonical list shape across all SDKs. */
export interface ListResult<T = DbRecord> {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
}

export interface AuthResult<T = DbRecord> {
  token: string;
  /** Canonical name for the signed-in user record. */
  user: T;
  /** PocketBase-shaped alias of `user`, kept for existing callers. */
  record: T;
}

export interface VectorHit<T = DbRecord> {
  id: string;
  distance: number;
  record: T;
}

export type FileInput = Blob | ArrayBuffer | Uint8Array;

export type TransactionOp =
  | { type: 'create'; collection: string; data: Record<string, unknown> }
  | { type: 'update'; collection: string; id: string; data: Record<string, unknown> }
  | { type: 'delete'; collection: string; id: string };

/**
 * Stable, language-neutral error codes. Every official SDK maps HTTP statuses to these
 * same codes so applications can branch on `code` without parsing messages.
 */
export type ErrorCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'rate_limited'
  | 'server_error'
  | 'http_error'
  | 'network_error'
  | 'timeout';

export function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 400: return 'bad_request';
    case 401: return 'unauthenticated';
    case 403: return 'forbidden';
    case 404: return 'not_found';
    case 409: return 'conflict';
    case 413: return 'payload_too_large';
    case 429: return 'rate_limited';
    default: return status >= 500 ? 'server_error' : 'http_error';
  }
}

export class InvisibleDBError extends Error {
  /** HTTP status, or 0 when no response was received (network error or timeout). */
  readonly status: number;
  /** Stable error code. See ErrorCode. */
  readonly code: ErrorCode;
  /** Parsed error body from the server (per-field validation details live here). */
  readonly data?: unknown;
  /** Server request id (X-Request-Id), when the server returned one. */
  readonly requestId?: string;

  constructor(
    status: number,
    message: string,
    data?: unknown,
    opts: { code?: ErrorCode; requestId?: string; cause?: unknown } = {},
  ) {
    super(`InvisibleDB ${status}: ${message}`, { cause: opts.cause });
    this.name = 'InvisibleDBError';
    this.status = status;
    this.code = opts.code ?? (status === 0 ? 'network_error' : codeForStatus(status));
    this.data = data;
    this.requestId = opts.requestId;
  }
}

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY: Required<RetryOptions> = { attempts: 3, baseDelayMs: 250, maxDelayMs: 4000 };
const RUNTIME_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/;

function assertRuntimeName(name: string, kind: 'rpc' | 'function'): string {
  if (!RUNTIME_NAME_RE.test(name)) throw new TypeError(`invalid ${kind} name: ${JSON.stringify(name)}`);
  return name;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Validation helpers. Field names and identifiers are interpolated into query
// strings and paths, so they are checked here rather than trusted.
// ---------------------------------------------------------------------------

const COLLECTION_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const FIELD_PATH_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

function assertCollection(name: string): string {
  if (!COLLECTION_RE.test(name)) throw new TypeError(`invalid collection name: ${JSON.stringify(name)}`);
  return name;
}

function assertField(name: string): string {
  if (!FIELD_PATH_RE.test(name)) throw new TypeError(`invalid field name: ${JSON.stringify(name)}`);
  return name;
}

/**
 * PocketBase filter string literal.
 * PocketBase's filter parser treats a backslash as a plain character, except that `\"` is an
 * escaped double quote. JSON.stringify is NOT safe here (it turns `\` into `\\`, which PocketBase
 * reads literally). Verified against PocketBase 0.36.5: only `"` needs escaping.
 * A value ending in a backslash cannot be expressed, because the closing quote would be escaped.
 */
function quoteLiteral(s: string): string {
  if (s.endsWith('\\')) {
    throw new TypeError('filter values cannot end with a backslash (PocketBase filter limitation)');
  }
  return `"${s.replace(/"/g, '\\"')}"`;
}

/** PocketBase filter literal for a JS value. */
function literal(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('filter numbers must be finite');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return quoteLiteral(value.toISOString());
  if (typeof value === 'string') return quoteLiteral(value);
  throw new TypeError(`unsupported filter value type: ${typeof value}`);
}

function parseErrorBody(text: string): { message: string; data?: unknown } {
  try {
    const parsed = JSON.parse(text) as { message?: unknown; data?: unknown };
    if (parsed && typeof parsed.message === 'string') return { message: parsed.message, data: parsed.data };
  } catch {
    /* not JSON */
  }
  return { message: text.slice(0, 300) };
}

// ---------------------------------------------------------------------------

export function createClient(opts: InvisibleDBOptions): InvisibleDB {
  return new InvisibleDB(opts);
}

export class InvisibleDB {
  private root: string;
  private apiKey?: string;
  private authToken?: string;
  private currentRecord: DbRecord | null = null;
  private authCollection: string;
  private fetchImpl: typeof fetch;
  private EventSourceImpl?: typeof EventSource;
  private timeoutMs: number;
  private retry: Required<RetryOptions> | null;

  constructor(opts: InvisibleDBOptions) {
    const base = opts.baseUrl ?? opts.url;
    if (!base) throw new Error('baseUrl (or url) is required');
    this.root = base.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.authToken = opts.authToken;
    this.authCollection = opts.authCollection ?? 'users';
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
    this.EventSourceImpl = opts.eventSourceImpl ?? globalThis.EventSource;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive number');
    this.retry = opts.retry === false ? null : { ...DEFAULT_RETRY, ...(opts.retry ?? {}) };
  }

  private credential(): string | undefined {
    return this.authToken || this.apiKey;
  }

  private authHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const credential = this.credential();
    return { ...extra, ...(credential ? { authorization: `Bearer ${credential}` } : {}) };
  }

  /** Core transport: timeout per attempt, bounded retries for idempotent methods, typed errors. */
  private async send<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>,
    credentialMode: 'current' | 'none' = 'current',
  ): Promise<T> {
    const url = new URL(this.root + path);
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers: Record<string, string> = body === undefined || isForm ? {} : { 'content-type': 'application/json' };
    if (credentialMode === 'current') Object.assign(headers, this.authHeaders());
    const payload = body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body);

    const idempotent = IDEMPOTENT_METHODS.has(method);
    const maxAttempts = idempotent && this.retry ? this.retry.attempts : 1;

    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        let res: Response;
        try {
          res = await this.fetchImpl(url.toString(), { method, headers, body: payload, signal: controller.signal });
        } catch (cause) {
          const timedOut = controller.signal.aborted;
          const error = new InvisibleDBError(
            0,
            timedOut ? `request timed out after ${this.timeoutMs}ms` : 'network request failed',
            undefined,
            { code: timedOut ? 'timeout' : 'network_error', cause },
          );
          if (attempt < maxAttempts) { await sleep(this.backoffMs(attempt)); continue; }
          throw error;
        }

        const requestId = res.headers?.get?.('x-request-id') ?? undefined;
        if (!res.ok) {
          if (idempotent && RETRYABLE_STATUS.has(res.status) && attempt < maxAttempts) {
            await sleep(this.backoffMs(attempt, res.headers?.get?.('retry-after') ?? null));
            continue;
          }
          const text = await res.text().catch(() => res.statusText);
          const parsed = parseErrorBody(text);
          throw new InvisibleDBError(res.status, parsed.message, parsed.data, { requestId });
        }
        if (res.status === 204) return undefined as T;
        try {
          return (await res.json()) as T;
        } catch (cause) {
          throw new InvisibleDBError(res.status, 'response was not valid JSON', undefined, { requestId, cause });
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  /** Delay before the next attempt: Retry-After when given, otherwise jittered exponential backoff. */
  private backoffMs(attempt: number, retryAfter: string | null = null): number {
    const cap = this.retry?.maxDelayMs ?? DEFAULT_RETRY.maxDelayMs;
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) return Math.min(cap, seconds * 1000);
    }
    const base = this.retry?.baseDelayMs ?? DEFAULT_RETRY.baseDelayMs;
    const exp = Math.min(cap, base * 2 ** (attempt - 1));
    return Math.floor(Math.random() * exp);
  }

  /** Raw request helpers. Path is relative to the instance root. */
  api = {
    get: <T>(path: string, query?: Record<string, string>) => this.send<T>('GET', path, undefined, query),
    post: <T>(path: string, body?: unknown) => this.send<T>('POST', path, body),
    patch: <T>(path: string, body?: unknown) => this.send<T>('PATCH', path, body),
    del: <T>(path: string) => this.send<T>('DELETE', path),
  };

  collection<T = DbRecord>(name: string): Collection<T> {
    return new Collection<T>(this, assertCollection(name));
  }

  /** Query builder entry point: db.from("tasks").select().eq("status", "open").execute() */
  from<T = DbRecord>(name: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this, assertCollection(name));
  }

  /**
   * Call a server-side procedure registered on the instance (runtime contract v1).
   * Rejected with `unauthenticated` for procedures that require a signed-in user.
   */
  rpc = <T = unknown>(name: string, params: Record<string, unknown> = {}): Promise<T> =>
    this.send<T>('POST', `/api/invisibledb/rpc/${assertRuntimeName(name, 'rpc')}`, params);

  functions = {
    /** Invoke a server-side function registered on the instance (runtime contract v1). */
    invoke: <T = unknown>(name: string, payload: Record<string, unknown> = {}): Promise<T> =>
      this.send<T>('POST', `/api/invisibledb/functions/${assertRuntimeName(name, 'function')}`, payload),
  };

  auth = {
    /** PocketBase-shaped login. Kept for existing callers; prefer signIn. */
    login: async <T = DbRecord>(collection: string, identity: string, password: string): Promise<AuthResult<T>> => {
      // Login is always public-lane traffic. Never attach an instance key.
      const result = await this.send<{ token: string; record: T }>(
        'POST',
        `/api/collections/${assertCollection(collection)}/auth-with-password`,
        { identity, password },
        undefined,
        'none',
      );
      this.authToken = result.token;
      this.currentRecord = result.record as unknown as DbRecord;
      return { token: result.token, user: result.record, record: result.record };
    },

    /** Canonical sign-in: { email, password } against the configured auth collection. */
    signIn: async <T = DbRecord>(credentials: { email: string; password: string }): Promise<AuthResult<T>> => {
      return this.auth.login<T>(this.authCollection, credentials.email, credentials.password);
    },

    /** Create an end-user account, then sign in as that user. */
    signUp: async <T = DbRecord>(
      input: { email: string; password: string; passwordConfirm?: string } & Record<string, unknown>,
    ): Promise<AuthResult<T>> => {
      const { passwordConfirm, ...rest } = input;
      await this.send<T>(
        'POST',
        `/api/collections/${this.authCollection}/records`,
        { ...rest, passwordConfirm: passwordConfirm ?? input.password },
        undefined,
        'none',
      );
      return this.auth.signIn<T>({ email: input.email, password: input.password });
    },

    /** Re-validate the stored token and rotate it. */
    refresh: async <T = DbRecord>(collection?: string): Promise<AuthResult<T>> => {
      if (!this.authToken) throw new Error('no end-user auth token is set');
      const name = assertCollection(collection ?? this.authCollection);
      const result = await this.send<{ token: string; record: T }>(
        'POST',
        `/api/collections/${name}/auth-refresh`,
      );
      this.authToken = result.token;
      this.currentRecord = result.record as unknown as DbRecord;
      return { token: result.token, user: result.record, record: result.record };
    },

    /** The signed-in user record as last seen by this client, or null. */
    currentUser: (): DbRecord | null => this.currentRecord,

    /** Clear the local session. */
    signOut: (): void => {
      this.authToken = undefined;
      this.currentRecord = null;
    },

    logout: (): void => this.auth.signOut(),

    /** Sends a password-reset email. Resolves the same way for unknown addresses (no enumeration). */
    resetPassword: async (email: string): Promise<void> => {
      await this.send<void>('POST', `/api/collections/${this.authCollection}/request-password-reset`, { email }, undefined, 'none');
    },

    confirmResetPassword: async (input: { token: string; password: string; passwordConfirm?: string }): Promise<void> => {
      await this.send<void>(
        'POST',
        `/api/collections/${this.authCollection}/confirm-password-reset`,
        { token: input.token, password: input.password, passwordConfirm: input.passwordConfirm ?? input.password },
        undefined,
        'none',
      );
    },

    /** Sends an email-verification message. */
    verifyEmail: async (email: string): Promise<void> => {
      await this.send<void>('POST', `/api/collections/${this.authCollection}/request-verification`, { email }, undefined, 'none');
    },

    confirmVerifyEmail: async (token: string): Promise<void> => {
      await this.send<void>('POST', `/api/collections/${this.authCollection}/confirm-verification`, { token }, undefined, 'none');
    },

    setToken: (token?: string): void => {
      this.authToken = token || undefined;
      this.currentRecord = null;
    },

    getToken: (): string | undefined => this.authToken,
  };

  storage = {
    /** Attach a file to an existing record's file field. Returns the updated record. */
    upload: (opts: { collection: string; recordId: string; field: string; file: FileInput; filename?: string }): Promise<DbRecord> => {
      const collection = assertCollection(opts.collection);
      const field = assertField(opts.field);
      const name = opts.filename ?? (typeof File !== 'undefined' && opts.file instanceof File ? opts.file.name : undefined);
      if (!name) throw new TypeError('filename is required when the file is not a named File');
      const blob = opts.file instanceof Blob ? opts.file : new Blob([opts.file as BlobPart]);
      const form = new FormData();
      form.append(field, blob, name);
      return this.send<DbRecord>('PATCH', `/api/collections/${collection}/records/${encodeURIComponent(opts.recordId)}`, form);
    },

    /** Remove one stored file from a record's file field. */
    remove: (opts: { collection: string; recordId: string; field: string; filename: string }): Promise<DbRecord> => {
      const field = assertField(opts.field);
      return this.send<DbRecord>(
        'PATCH',
        `/api/collections/${assertCollection(opts.collection)}/records/${encodeURIComponent(opts.recordId)}`,
        { [`${field}-`]: [opts.filename] },
      );
    },

    /** Direct, public file URL. Works for files whose collection view rule is public. */
    url: (collection: string, recordId: string, filename: string, opts: { thumb?: string } = {}): string => {
      const base = `${this.root}/api/files/${assertCollection(collection)}/${encodeURIComponent(recordId)}/${encodeURIComponent(filename)}`;
      return opts.thumb ? `${base}?thumb=${encodeURIComponent(opts.thumb)}` : base;
    },

    /**
     * Short-lived URL for protected files. Requires a signed-in user (or a server key).
     * Calls the file-token endpoint, then appends `?token=`.
     */
    signedUrl: async (collection: string, recordId: string, filename: string, opts: { thumb?: string } = {}): Promise<string> => {
      const { token } = await this.send<{ token: string }>('POST', '/api/files/token');
      const base = this.storage.url(collection, recordId, filename, opts);
      return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    },
  };

  /** Direct file URL helper (kept for existing callers; prefer storage.url). */
  fileUrl(collection: string, recordId: string, filename: string): string {
    return this.storage.url(collection, recordId, filename);
  }

  /**
   * Run several record writes atomically via PocketBase batch. Requires batch to be
   * enabled on the instance; otherwise the server returns 403 and nothing is written.
   */
  transaction = async (ops: TransactionOp[]): Promise<Array<{ status: number; body: unknown }>> => {
    if (ops.length === 0) return [];
    const requests = ops.map((op) => {
      const c = assertCollection(op.collection);
      if (op.type === 'create') return { method: 'POST', url: `/api/collections/${c}/records`, body: op.data };
      const id = encodeURIComponent(op.id);
      if (op.type === 'update') return { method: 'PATCH', url: `/api/collections/${c}/records/${id}`, body: op.data };
      return { method: 'DELETE', url: `/api/collections/${c}/records/${id}` };
    });
    return this.send('POST', '/api/batch', { requests });
  };

  vector = {
    upsert: (collection: string, id: string, embedding: number[]) =>
      this.send<{ ok: boolean; dimensions: number }>('POST', '/api/vector/upsert', { collection, id, embedding }),
    remove: (collection: string, id: string) =>
      this.send<{ ok: boolean }>('POST', '/api/vector/delete', { collection, id }),
    query: <T = DbRecord>(collection: string, embedding: number[], limit = 10) =>
      this.send<{ results: VectorHit<T>[]; dimensions: number }>('POST', '/api/vector/query', { collection, embedding, limit }),
    status: () => this.send<{ collections: Array<{ collection: string; dimensions: number }> }>('GET', '/api/vector/status'),
  };

  realtime = {
    /** Subscribe to every create/update/delete on a collection. Returns an unsubscribe function. */
    subscribe: <T = DbRecord>(collection: string, callback: (event: { action: string; record: T }) => void): (() => void) =>
      this.collection<T>(collection).subscribe(callback),
  };

  health = () => this.send<{ message: string; data: Record<string, unknown> }>('GET', '/api/health');

  /** @internal used by Collection and QueryBuilder. */
  _internal = {
    send: <T>(method: string, path: string, body?: unknown, query?: Record<string, string>) =>
      this.send<T>(method, path, body, query),
    root: () => this.root,
    authHeaders: () => this.authHeaders(),
    fetch: () => this.fetchImpl,
    eventSource: () => this.EventSourceImpl,
  };
}

/** PocketBase-shaped collection access. Thin, unopinionated. */
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
    return this.db.api.get<T>(`/api/collections/${this.name}/records/${encodeURIComponent(id)}`);
  }

  create(data: Partial<T>): Promise<T> {
    return this.db.api.post<T>(`/api/collections/${this.name}/records`, data);
  }

  update(id: string, data: Partial<T>): Promise<T> {
    return this.db.api.patch<T>(`/api/collections/${this.name}/records/${encodeURIComponent(id)}`, data);
  }

  delete(id: string): Promise<void> {
    return this.db.api.del<void>(`/api/collections/${this.name}/records/${encodeURIComponent(id)}`);
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

/**
 * Chainable query builder. Compiles to PocketBase list/record requests.
 * `await builder` is the same as `builder.execute()`.
 */
export class QueryBuilder<T = DbRecord> implements PromiseLike<ListResult<T>> {
  private fieldList: string[] = [];
  private filters: string[] = [];
  private sorts: string[] = [];
  private expands: string[] = [];
  private pageNo = 1;
  private pageSize?: number;

  constructor(private db: InvisibleDB, private table: string) {}

  /** Projection. No argument or "*" returns every field. */
  select(fields: string | string[] = '*'): this {
    const list = (Array.isArray(fields) ? fields : fields.split(','))
      .map((f) => f.trim())
      .filter(Boolean);
    this.fieldList = list.length === 0 || list.includes('*') ? [] : list.map(assertField);
    return this;
  }

  eq(field: string, value: unknown): this { return this.op(field, '=', value); }
  neq(field: string, value: unknown): this { return this.op(field, '!=', value); }
  gt(field: string, value: unknown): this { return this.op(field, '>', value); }
  gte(field: string, value: unknown): this { return this.op(field, '>=', value); }
  lt(field: string, value: unknown): this { return this.op(field, '<', value); }
  lte(field: string, value: unknown): this { return this.op(field, '<=', value); }

  /** Substring match (PocketBase `~`). */
  contains(field: string, value: string): this { return this.op(field, '~', value); }

  in(field: string, values: unknown[]): this {
    if (values.length === 0) throw new TypeError('in() needs at least one value');
    const f = assertField(field);
    this.filters.push(`(${values.map((v) => `${f} = ${literal(v)}`).join(' || ')})`);
    return this;
  }

  /** Escape hatch: a raw PocketBase filter expression. ANDed with the other filters. */
  filter(expression: string): this {
    this.filters.push(`(${expression})`);
    return this;
  }

  order(field: string, opts: { ascending?: boolean } = {}): this {
    const f = assertField(field);
    this.sorts.push(opts.ascending === false ? `-${f}` : f);
    return this;
  }

  expand(relations: string | string[]): this {
    const list = Array.isArray(relations) ? relations : relations.split(',');
    for (const r of list.map((s) => s.trim()).filter(Boolean)) this.expands.push(assertField(r));
    return this;
  }

  /** Page size. Also resets to page 1. */
  limit(n: number): this {
    if (!Number.isInteger(n) || n < 1) throw new TypeError('limit must be a positive integer');
    this.pageSize = n;
    this.pageNo = 1;
    return this;
  }

  page(n: number): this {
    if (!Number.isInteger(n) || n < 1) throw new TypeError('page must be a positive integer');
    this.pageNo = n;
    return this;
  }

  private op(field: string, operator: string, value: unknown): this {
    this.filters.push(`${assertField(field)} ${operator} ${literal(value)}`);
    return this;
  }

  private query(): Record<string, string> {
    const q: Record<string, string> = {};
    if (this.pageNo > 1) q.page = String(this.pageNo);
    if (this.pageSize) q.perPage = String(this.pageSize);
    if (this.fieldList.length) q.fields = this.fieldList.join(',');
    if (this.filters.length) q.filter = this.filters.join(' && ');
    if (this.sorts.length) q.sort = this.sorts.join(',');
    if (this.expands.length) q.expand = this.expands.join(',');
    return q;
  }

  private listPath(): string {
    return `/api/collections/${this.table}/records`;
  }

  /** Run the query and return the canonical list shape. */
  execute(): Promise<ListResult<T>> {
    return this.db._internal.send<ListResult<T>>('GET', this.listPath(), undefined, this.query());
  }

  then<R1 = ListResult<T>, R2 = never>(
    onfulfilled?: ((value: ListResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  /** Exactly one matching row. Throws 404 when none match and 409 when more than one does. */
  async single(): Promise<T> {
    const result = await this.limit(2).execute();
    if (result.totalItems === 0) throw new InvisibleDBError(404, 'no rows matched');
    if (result.totalItems > 1) throw new InvisibleDBError(409, `expected one row, found ${result.totalItems}`);
    return result.items[0];
  }

  /** The first matching row, or null. */
  async maybeSingle(): Promise<T | null> {
    const result = await this.limit(1).execute();
    return result.items[0] ?? null;
  }

  /** Count matching rows without fetching them. */
  async count(): Promise<number> {
    const result = await this.limit(1).execute();
    return result.totalItems;
  }

  /** Query string for single-record routes: only `fields` and `expand` apply there. */
  private recordQuery(): Record<string, string> | undefined {
    const q: Record<string, string> = {};
    if (this.fieldList.length) q.fields = this.fieldList.join(',');
    if (this.expands.length) q.expand = this.expands.join(',');
    return Object.keys(q).length ? q : undefined;
  }

  /** Fetch one record by id. Honours select() and expand(). */
  get(id: string): Promise<T> {
    return this.db._internal.send<T>('GET', `${this.listPath()}/${encodeURIComponent(id)}`, undefined, this.recordQuery());
  }

  /** Create a record. Honours select() and expand() on the returned record. */
  insert(data: Partial<T> | Record<string, unknown>): Promise<T> {
    return this.db._internal.send<T>('POST', this.listPath(), data, this.recordQuery());
  }

  /** Update a record. Honours select() and expand() on the returned record. */
  update(id: string, data: Partial<T> | Record<string, unknown>): Promise<T> {
    return this.db._internal.send<T>('PATCH', `${this.listPath()}/${encodeURIComponent(id)}`, data, this.recordQuery());
  }

  /** Delete one record by id. Bulk delete is intentionally not offered. */
  remove(id: string): Promise<void> {
    return this.db._internal.send<void>('DELETE', `${this.listPath()}/${encodeURIComponent(id)}`);
  }
}
