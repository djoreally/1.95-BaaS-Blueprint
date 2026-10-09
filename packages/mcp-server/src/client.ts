import type { EvidenceState } from '@baas-195/zeroai-addon';

export type InstanceStatus = 'provisioning' | 'ready' | 'failed' | 'suspended';
export type InstancePlan = 'seat' | 'dev';
export type GateName = 'typecheck' | 'unit-tests' | 'integration-tests' | 'security' | 'migration-safety' | 'production-readiness';
export interface InstanceSummary { id: string; name: string; fqdn: string; status: InstanceStatus; plan: InstancePlan; createdAt: string }
export interface ProvisionInput { name: string; domain?: string; plan?: InstancePlan }
export interface InstanceKeys { instanceId: string; baseUrl: string; adminUrl: string; apiKey: string; dartSnippet: string; restSnippet: string }
export interface QueryOptions { page?: number; perPage?: number }
export interface QueryResult { instanceId: string; collection: string; items: Record<string, unknown>[]; totalItems: number; page: number; perPage: number }
export interface GateCheckResult { instanceId: string; gate: GateName; state: EvidenceState; evidence: string[]; checkedAt: string }
export interface ControlPlaneStatus { ok: boolean; version: string; instances: number }
export type MigrationAction = 'plan' | 'create' | 'start' | 'prepare' | 'batch' | 'auth_batch' | 'file' | 'resolve' | 'verify' | 'cutover' | 'rollback';
export interface InvisibleDBClient {
  provision(input: ProvisionInput): Promise<InstanceSummary>; list(): Promise<InstanceSummary[]>; keys(instance: string): Promise<InstanceKeys>;
  query(instance: string, collection: string, filter?: string, opts?: QueryOptions): Promise<QueryResult>; gateCheck(instance: string, gate: GateName): Promise<GateCheckResult>;
  migration(instance: string, action: MigrationAction, payload?: Record<string, unknown>): Promise<unknown>; migrationStatus(instance: string, migrationId?: string): Promise<unknown>; status(): Promise<ControlPlaneStatus>;
}
export interface HttpTransport { request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> }
export class NoTransportError extends Error { constructor() { super('InvisibleDBClient: no HTTP transport configured. Set INVISIBLED_API_URL and INVISIBLED_API_KEY.'); this.name = 'NoTransportError'; } }
export function stubTransport(): HttpTransport { return { async request() { throw new NoTransportError(); } }; }
export function fetchTransport(baseUrl: string, apiKey: string): HttpTransport {
  const root = baseUrl.replace(/\/+$/, '');
  return { async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${root}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) { const detail = await res.text().catch(() => res.statusText); throw new Error(`InvisibleDB API ${method} ${path}: ${res.status} ${detail.slice(0, 500)}`); }
    if (res.status === 204) return undefined as T; return (await res.json()) as T;
  } };
}
export function fakeTransport(seed: { instances?: InstanceSummary[]; keys?: Record<string, InstanceKeys> } = {}): HttpTransport {
  const instances = [...(seed.instances ?? [])]; const keys = { ...(seed.keys ?? {}) }; const migrations = new Map<string, Record<string, unknown>>(); let seq = instances.length; let migrationSeq = 0;
  return { async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const notFound = () => { throw new Error(`fakeTransport: no route ${method} ${path}`); };
    if (method === 'GET' && path === '/api/status') return { ok: true, version: '0.2.0-fake', instances: instances.length } as T;
    if (method === 'GET' && path === '/api/instances') return instances as T;
    if (method === 'POST' && path === '/api/instances') { const input = body as ProvisionInput; seq += 1; const inst: InstanceSummary = { id: `inst_${seq}`, name: input.name, fqdn: `${input.name}.${input.domain ?? 'invisibledb.app'}`, status: 'ready', plan: input.plan ?? 'seat', createdAt: new Date().toISOString() }; instances.push(inst); return inst as T; }
    const keysMatch = path.match(/^\/api\/instances\/([^/]+)\/keys$/); if (method === 'GET' && keysMatch) { const k = keys[decodeURIComponent(keysMatch[1])]; if (!k) return notFound(); return k as T; }
    const queryMatch = path.match(/^\/api\/instances\/([^/]+)\/query$/); if (method === 'POST' && queryMatch) { const q = body as { collection: string; page?: number; perPage?: number }; return { instanceId: decodeURIComponent(queryMatch[1]), collection: q.collection, items: [], totalItems: 0, page: q.page ?? 1, perPage: q.perPage ?? 30 } as T; }
    const gateMatch = path.match(/^\/api\/instances\/([^/]+)\/gates\/([^/]+)$/); if (method === 'GET' && gateMatch) return { instanceId: decodeURIComponent(gateMatch[1]), gate: decodeURIComponent(gateMatch[2]), state: 'UNKNOWN', evidence: [], checkedAt: new Date().toISOString() } as T;
    const migrationMatch = path.match(/^\/api\/instances\/([^/]+)\/migrations(?:\?id=([^&]+))?$/);
    if (migrationMatch && method === 'GET') { const id = migrationMatch[2] ? decodeURIComponent(migrationMatch[2]) : undefined; if (id) return (migrations.get(id) ?? notFound()) as T; return [...migrations.values()] as T; }
    if (migrationMatch && method === 'POST') {
      const input = body as Record<string, unknown>; if (input.action === 'plan') return { compatibility: 100, blockers: [], warnings: [], collections: [] } as T;
      if (input.action === 'create') { migrationSeq += 1; const id = `mig_${migrationSeq}`; const job = { id, status: 'planned', sourceProvider: ((input.manifest as Record<string, any>)?.source?.provider ?? 'custom') }; migrations.set(id, job); return job as T; }
      const id = String(input.migrationId ?? ''); const job = migrations.get(id); if (!job) return notFound(); const statusByAction: Record<string, string> = { start: 'snapshotting', prepare: 'schema_ready', batch: 'importing', auth_batch: 'importing', file: 'importing', resolve: String(job.status ?? 'importing'), verify: 'verified', cutover: 'cutover', rollback: 'rolling_back' }; Object.assign(job, { status: statusByAction[String(input.action)] ?? job.status }); return job as T;
    }
    return notFound();
  } };
}
export class RestInvisibleDBClient implements InvisibleDBClient {
  constructor(private readonly transport: HttpTransport = stubTransport()) {}
  status(): Promise<ControlPlaneStatus> { return this.transport.request('GET', '/api/status'); }
  list(): Promise<InstanceSummary[]> { return this.transport.request('GET', '/api/instances'); }
  provision(input: ProvisionInput): Promise<InstanceSummary> { return this.transport.request('POST', '/api/instances', input); }
  keys(instance: string): Promise<InstanceKeys> { return this.transport.request('GET', `/api/instances/${encodeURIComponent(instance)}/keys`); }
  query(instance: string, collection: string, filter?: string, opts: QueryOptions = {}): Promise<QueryResult> { return this.transport.request('POST', `/api/instances/${encodeURIComponent(instance)}/query`, { collection, filter, page: opts.page, perPage: opts.perPage }); }
  gateCheck(instance: string, gate: GateName): Promise<GateCheckResult> { return this.transport.request('GET', `/api/instances/${encodeURIComponent(instance)}/gates/${encodeURIComponent(gate)}`); }
  migration(instance: string, action: MigrationAction, payload: Record<string, unknown> = {}): Promise<unknown> { return this.transport.request('POST', `/api/instances/${encodeURIComponent(instance)}/migrations`, { action, ...payload }); }
  migrationStatus(instance: string, migrationId?: string): Promise<unknown> { const query = migrationId ? `?id=${encodeURIComponent(migrationId)}` : ''; return this.transport.request('GET', `/api/instances/${encodeURIComponent(instance)}/migrations${query}`); }
}
export function clientFromEnv(): InvisibleDBClient { const baseUrl = process.env['INVISIBLED_API_URL']; const apiKey = process.env['INVISIBLED_API_KEY']; return baseUrl && apiKey ? new RestInvisibleDBClient(fetchTransport(baseUrl, apiKey)) : new RestInvisibleDBClient(stubTransport()); }
