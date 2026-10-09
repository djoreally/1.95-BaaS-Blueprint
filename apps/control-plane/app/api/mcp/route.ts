import { NextResponse } from 'next/server';
import { apiUser, requireOwnedInstance } from '../../../lib/api-auth';
import { decryptSecret } from '../../../lib/crypto';
import { prisma } from '../../../lib/db';
import { instanceRequest } from '../../../lib/instance-api';
import { runMigrationAction } from '../../../lib/migration-actions';
import { POSTGRES_DISCOVERY } from '../../../lib/migration-discovery';

export const dynamic = 'force-dynamic';
const BASE_DOMAIN = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';
const SUPPORTED_PROTOCOLS = ['2025-11-25', '2025-06-18'] as const;
const DEFAULT_PROTOCOL = SUPPORTED_PROTOCOLS[0];
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });

const TOOLS = [
  { name: 'idb_status', description: 'InvisibleDB control-plane status.', inputSchema: obj({}) },
  { name: 'idb_list', description: 'List instances owned by this account.', inputSchema: obj({}) },
  { name: 'idb_provision', description: 'Provision a hosted InvisibleDB instance. Requires an active hosted entitlement.', inputSchema: obj({ name: str('URL-safe instance slug') }, ['name']) },
  { name: 'idb_keys', description: 'Get the secret destination instance key and SDK snippets. Never log this output.', inputSchema: obj({ instance: str() }, ['instance']) },
  { name: 'idb_query', description: 'Query a destination collection.', inputSchema: obj({ instance: str(), collection: str(), filter: str(), page: { type: 'integer', minimum: 1 }, perPage: { type: 'integer', minimum: 1, maximum: 200 } }, ['instance','collection']) },
  { name: 'idb_migration_manifest_spec', description: 'Get MigrationManifest v1.0 and read-only Lovable/Supabase/Postgres discovery SQL, including exact-count instructions.', inputSchema: obj({}) },
  { name: 'idb_migration_plan', description: 'Compile a source manifest into a read-only compatibility plan.', inputSchema: obj({ instance: str(), manifest: { type: 'object', additionalProperties: true } }, ['instance','manifest']) },
  { name: 'idb_migration_create', description: 'Persist a reviewed migration job.', inputSchema: obj({ instance: str(), manifest: { type: 'object', additionalProperties: true } }, ['instance','manifest']) },
  { name: 'idb_migration_start', description: 'Queue a pre-migration destination snapshot.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_prepare', description: 'After snapshot completion, create destination schema, relations, and indexes.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_batch', description: 'Import an idempotent 1-500 row data batch.', inputSchema: obj({ instance: str(), migrationId: str(), batchKey: str(), collection: str(), records: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object', additionalProperties: true } }, checksum: str() }, ['instance','migrationId','batchKey','collection','records']) },
  { name: 'idb_migration_auth_batch', description: 'Import an idempotent 1-500 user identity batch.', inputSchema: obj({ instance: str(), migrationId: str(), batchKey: str(), collection: str(), users: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object', additionalProperties: true } } }, ['instance','migrationId','batchKey','users']) },
  { name: 'idb_migration_file', description: 'Stream one source storage object from a validated signed HTTPS URL into a destination file field.', inputSchema: obj({ instance: str(), migrationId: str(), collection: str(), sourceRecordId: str(), field: str(), filename: str(), sourceUrl: str(), expectedSha256: str() }, ['instance','migrationId','collection','sourceRecordId','field','filename','sourceUrl']) },
  { name: 'idb_migration_resolve', description: 'Resolve one active cutover blocker only with concrete evidence of the rewrite or fix.', inputSchema: obj({ instance: str(), migrationId: str(), blocker: str(), evidence: str() }, ['instance','migrationId','blocker','evidence']) },
  { name: 'idb_migration_verify', description: 'Verify exact source/import/destination evidence; returns VERIFIED, PARTIAL, or FAILED.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_cutover', description: 'Generate cutover configuration. Refuses unless evidence is VERIFIED.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_rollback', description: 'Queue restore from the captured pre-migration backup.', inputSchema: obj({ instance: str(), migrationId: str(), backup: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_status', description: 'Read one migration or recent migrations for an instance.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance']) },
];

const MIGRATION_TO_ACTION: Record<string, string> = {
  idb_migration_plan: 'plan', idb_migration_create: 'create', idb_migration_start: 'start', idb_migration_prepare: 'prepare',
  idb_migration_batch: 'batch', idb_migration_auth_batch: 'auth_batch', idb_migration_file: 'file', idb_migration_resolve: 'resolve',
  idb_migration_verify: 'verify', idb_migration_cutover: 'cutover', idb_migration_rollback: 'rollback', idb_migration_status: 'status',
};

function rpc(id: unknown, result: unknown, status = 200) { return NextResponse.json({ jsonrpc: '2.0', id, result }, { status, headers: { 'Cache-Control': 'no-store' } }); }
function rpcError(id: unknown, code: number, message: string, data?: unknown, status = 200) { return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } }, { status, headers: { 'Cache-Control': 'no-store' } }); }
function toolResult(payload: unknown, isError = false) { return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], ...(isError ? { isError: true } : {}) }; }

async function callTool(user: { id: string; email: string }, name: string, args: Record<string, any>) {
  const slug = String(args.instance || '');
  if (!['idb_status','idb_list','idb_provision','idb_migration_manifest_spec'].includes(name)) {
    if (!slug || !(await requireOwnedInstance(user.id, slug))) throw new Error('instance not found');
  }
  if (name === 'idb_status') return { ok: true, version: '0.2.0', instances: await prisma.provisionRequest.count({ where: { userId: user.id, kind: 'provision', status: 'done' } }) };
  if (name === 'idb_list') {
    const rows = await prisma.provisionRequest.findMany({ where: { userId: user.id, kind: 'provision' }, orderBy: { createdAt: 'desc' } });
    const seen = new Set<string>();
    return rows.filter((row) => !seen.has(row.slug) && seen.add(row.slug)).map((row) => ({ id: row.id, name: row.slug, fqdn: `${row.slug}.${BASE_DOMAIN}`, status: row.status === 'done' ? 'ready' : row.status === 'failed' ? 'failed' : 'provisioning', plan: 'seat', createdAt: row.createdAt.toISOString() }));
  }
  if (name === 'idb_provision') {
    const instanceName = String(args.name || '').toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(instanceName)) throw new Error('invalid instance name');
    const entitlement = await prisma.billingSubscription.findFirst({ where: { userId: user.id, entitlementActive: true } });
    if (!entitlement) throw new Error('active hosted entitlement required');
    const existing = await prisma.provisionRequest.findFirst({ where: { userId: user.id, slug: instanceName, kind: 'provision', status: { in: ['pending','claimed','done'] } }, orderBy: { createdAt: 'desc' } });
    const row = existing ?? await prisma.provisionRequest.create({ data: { kind: 'provision', userId: user.id, email: user.email, slug: instanceName } });
    return { id: row.id, name: row.slug, fqdn: `${row.slug}.${BASE_DOMAIN}`, status: row.status === 'done' ? 'ready' : 'provisioning', plan: 'seat', createdAt: row.createdAt.toISOString() };
  }
  if (name === 'idb_keys') {
    const credential = await prisma.instanceCredential.findUnique({ where: { userId_slug: { userId: user.id, slug } } });
    if (!credential) throw new Error('management credential is still synchronizing');
    const apiKey = decryptSecret(credential.apiKeyEncrypted); const baseUrl = `https://${slug}.${BASE_DOMAIN}`;
    return { instanceId: slug, baseUrl, adminUrl: `${baseUrl}/_/`, apiKey, restSnippet: `curl -H 'Authorization: Bearer ${apiKey}' '${baseUrl}/api/collections'` };
  }
  if (name === 'idb_query') {
    const collection = String(args.collection || ''); if (!/^[A-Za-z0-9_-]+$/.test(collection)) throw new Error('valid collection required');
    const page = Math.max(1, Number(args.page || 1)); const perPage = Math.min(200, Math.max(1, Number(args.perPage || 30))); const query: Record<string,string> = { page: String(page), perPage: String(perPage) }; if (args.filter) query.filter = String(args.filter);
    const result = await instanceRequest<any>(user.id, slug, 'GET', `/api/collections/${collection}/records`, undefined, query);
    return { instanceId: slug, collection, items: result.items ?? [], totalItems: result.totalItems ?? 0, page: result.page ?? page, perPage: result.perPage ?? perPage };
  }
  if (name === 'idb_migration_manifest_spec') return POSTGRES_DISCOVERY;
  const action = MIGRATION_TO_ACTION[name];
  if (action) return runMigrationAction(user.id, slug, { action, ...args });
  throw new Error(`unknown tool: ${name}`);
}

export async function POST(req: Request) {
  const message = await req.json().catch(() => null) as any;
  if (!message || message.jsonrpc !== '2.0' || !message.method) return rpcError(message?.id ?? null, -32600, 'Invalid Request', undefined, 400);
  if (message.method === 'initialize') {
    const requested = String(message.params?.protocolVersion || '');
    const protocolVersion = (SUPPORTED_PROTOCOLS as readonly string[]).includes(requested) ? requested : DEFAULT_PROTOCOL;
    return rpc(message.id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'InvisibleDB', version: '0.2.0' }, instructions: 'Agent-native backend management and evidence-gated migrations. For Lovable migrations, call idb_migration_manifest_spec first.' });
  }
  if (message.method === 'notifications/initialized') return new NextResponse(null, { status: 202 });
  const user = await apiUser(req); if (!user) return rpcError(message.id ?? null, -32001, 'Unauthorized', undefined, 401);
  if (message.method === 'tools/list') return rpc(message.id, { tools: TOOLS });
  if (message.method === 'tools/call') {
    const name = String(message.params?.name || ''); const args = (message.params?.arguments ?? {}) as Record<string, any>;
    try { return rpc(message.id, toolResult(await callTool(user, name, args))); }
    catch (error) { return rpc(message.id, toolResult({ error: error instanceof Error ? error.message : 'tool call failed' }, true)); }
  }
  return rpcError(message.id ?? null, -32601, 'Method not found');
}

export async function GET() { return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } }); }
