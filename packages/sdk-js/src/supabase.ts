export interface SupabaseCompatOptions { fetchImpl?: typeof fetch; authCollection?: string }
export interface SupabaseResult<T> { data: T | null; error: { message: string; status?: number } | null; count?: number | null; status: number; statusText: string }

type Filter = { field: string; op: '=' | '!=' | '>' | '>=' | '<' | '<=' | '~'; value: unknown };
type Mode = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

function quote(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value));
}

class CompatQuery<T = Record<string, unknown>> implements PromiseLike<SupabaseResult<T[] | T>> {
  private mode: Mode = 'select';
  private payload: unknown;
  private filters: Filter[] = [];
  private columns = '*';
  private wantSingle = false;
  private wantMaybeSingle = false;
  private wantCount = false;
  private limitValue?: number;
  private orderField?: string;
  private orderAsc = true;

  constructor(private root: string, private table: string, private fetchImpl: typeof fetch, private token: () => string | undefined) {}
  select(columns = '*', opts?: { count?: string }): this { this.columns = columns; this.wantCount = Boolean(opts?.count); if (this.mode === 'select') this.mode = 'select'; return this; }
  insert(values: unknown): this { this.mode = 'insert'; this.payload = values; return this; }
  upsert(values: unknown): this { this.mode = 'upsert'; this.payload = values; return this; }
  update(values: unknown): this { this.mode = 'update'; this.payload = values; return this; }
  delete(): this { this.mode = 'delete'; return this; }
  eq(field: string, value: unknown): this { this.filters.push({ field, op: '=', value }); return this; }
  neq(field: string, value: unknown): this { this.filters.push({ field, op: '!=', value }); return this; }
  gt(field: string, value: unknown): this { this.filters.push({ field, op: '>', value }); return this; }
  gte(field: string, value: unknown): this { this.filters.push({ field, op: '>=', value }); return this; }
  lt(field: string, value: unknown): this { this.filters.push({ field, op: '<', value }); return this; }
  lte(field: string, value: unknown): this { this.filters.push({ field, op: '<=', value }); return this; }
  like(field: string, value: unknown): this { this.filters.push({ field, op: '~', value }); return this; }
  ilike(field: string, value: unknown): this { this.filters.push({ field, op: '~', value }); return this; }
  limit(value: number): this { this.limitValue = Math.max(1, Math.min(200, value)); return this; }
  order(field: string, opts?: { ascending?: boolean }): this { this.orderField = field; this.orderAsc = opts?.ascending !== false; return this; }
  single(): this { this.wantSingle = true; return this; }
  maybeSingle(): this { this.wantMaybeSingle = true; return this; }

  private headers(json = false): Record<string, string> {
    const token = this.token();
    return { ...(json ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  }
  private filterString(): string { return this.filters.map((f) => `${f.field} ${f.op} ${quote(f.value)}`).join(' && '); }
  private project(row: any): any {
    if (this.columns.trim() === '*' || !row || typeof row !== 'object') return row;
    const wanted = this.columns.split(',').map((x) => x.trim()).filter(Boolean);
    return Object.fromEntries(wanted.map((key) => [key, row[key]]));
  }
  private async list(): Promise<{ rows: any[]; total: number; status: number; statusText: string }> {
    const url = new URL(`${this.root}/api/collections/${encodeURIComponent(this.table)}/records`);
    url.searchParams.set('page', '1'); url.searchParams.set('perPage', String(this.limitValue ?? 200));
    const filter = this.filterString(); if (filter) url.searchParams.set('filter', filter);
    if (this.orderField) url.searchParams.set('sort', `${this.orderAsc ? '' : '-'}${this.orderField}`);
    const res = await this.fetchImpl(url.toString(), { headers: this.headers() });
    if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
    const body = await res.json() as { items?: any[]; totalItems?: number };
    return { rows: (body.items ?? []).map((r) => this.project(r)), total: body.totalItems ?? 0, status: res.status, statusText: res.statusText };
  }
  private async execute(): Promise<SupabaseResult<any>> {
    try {
      if (this.mode === 'select') {
        const listed = await this.list();
        const data = this.wantSingle ? listed.rows[0] ?? null : this.wantMaybeSingle ? listed.rows[0] ?? null : listed.rows;
        if (this.wantSingle && listed.rows.length !== 1) return { data: null, error: { message: `Expected one row, received ${listed.rows.length}`, status: 406 }, count: this.wantCount ? listed.total : null, status: 406, statusText: 'Not Acceptable' };
        return { data, error: null, count: this.wantCount ? listed.total : null, status: listed.status, statusText: listed.statusText };
      }
      const values = Array.isArray(this.payload) ? this.payload : [this.payload];
      if (this.mode === 'insert' || this.mode === 'upsert') {
        const out: any[] = [];
        for (const value of values) {
          const row = value as Record<string, unknown>;
          let res = await this.fetchImpl(`${this.root}/api/collections/${encodeURIComponent(this.table)}/records`, { method: 'POST', headers: this.headers(true), body: JSON.stringify(row) });
          if (!res.ok && this.mode === 'upsert' && typeof row.id === 'string') res = await this.fetchImpl(`${this.root}/api/collections/${encodeURIComponent(this.table)}/records/${encodeURIComponent(row.id)}`, { method: 'PATCH', headers: this.headers(true), body: JSON.stringify(row) });
          if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
          out.push(this.project(await res.json()));
        }
        return { data: this.wantSingle ? out[0] ?? null : out, error: null, status: 200, statusText: 'OK' };
      }
      const listed = await this.list();
      const out: any[] = [];
      for (const row of listed.rows) {
        if (!row.id) continue;
        const res = await this.fetchImpl(`${this.root}/api/collections/${encodeURIComponent(this.table)}/records/${encodeURIComponent(row.id)}`, { method: this.mode === 'delete' ? 'DELETE' : 'PATCH', headers: this.headers(this.mode === 'update'), body: this.mode === 'update' ? JSON.stringify(this.payload ?? {}) : undefined });
        if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
        if (this.mode === 'update') out.push(this.project(await res.json()));
        else out.push(row);
      }
      return { data: this.wantSingle ? out[0] ?? null : out, error: null, count: this.wantCount ? listed.total : null, status: 200, statusText: 'OK' };
    } catch (error) {
      const e = error as Error & { status?: number };
      return { data: null, error: { message: e.message, status: e.status }, status: e.status ?? 500, statusText: 'Error' };
    }
  }
  then<TResult1 = SupabaseResult<T[] | T>, TResult2 = never>(onfulfilled?: ((value: SupabaseResult<T[] | T>) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }
}

export function createClient(baseUrl: string, _legacyAnonKey?: string, options: SupabaseCompatOptions = {}) {
  const root = baseUrl.replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const authCollection = options.authCollection ?? 'users';
  let authToken: string | undefined;
  let currentUser: any = null;
  return {
    from<T = Record<string, unknown>>(table: string) { return new CompatQuery<T>(root, table, fetchImpl, () => authToken); },
    auth: {
      async signInWithPassword(input: { email: string; password: string }) {
        try {
          const res = await fetchImpl(`${root}/api/collections/${encodeURIComponent(authCollection)}/auth-with-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identity: input.email, password: input.password }) });
          if (!res.ok) throw Object.assign(new Error(await res.text()), { status: res.status });
          const result = await res.json() as { token: string; record: unknown }; authToken = result.token; currentUser = result.record;
          return { data: { user: currentUser, session: { access_token: authToken, user: currentUser } }, error: null };
        } catch (error) { return { data: { user: null, session: null }, error: { message: (error as Error).message } }; }
      },
      async signOut() { authToken = undefined; currentUser = null; return { error: null }; },
      async getSession() { return { data: { session: authToken ? { access_token: authToken, user: currentUser } : null }, error: null }; },
      async getUser() { return { data: { user: currentUser }, error: null }; },
      setSession(session: { access_token: string; user?: unknown }) { authToken = session.access_token; currentUser = session.user ?? currentUser; return Promise.resolve({ data: { session }, error: null }); },
      onAuthStateChange(callback: (event: string, session: unknown) => void) { callback('INITIAL_SESSION', authToken ? { access_token: authToken, user: currentUser } : null); return { data: { subscription: { unsubscribe() {} } } }; },
    },
  };
}
