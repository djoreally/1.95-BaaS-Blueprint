import { NextResponse } from 'next/server';
import { apiUser, requireOwnedInstance } from '../../../lib/api-auth';
import { decryptSecret } from '../../../lib/crypto';
import { prisma } from '../../../lib/db';
import { instanceRequest } from '../../../lib/instance-api';
import { assertMigrationManifest, compileMigrationPlan } from '../../../lib/migration-manifest';
import { createMigration, cutoverMigration, importAuthBatch, importMigrationBatch, importMigrationFile, migrationStatus, queueMigrationSnapshot, rollbackMigration, verifyMigration } from '../../../lib/migrations';
import { prepareMigrationWithIndexes } from '../../../lib/migration-indexes';
import { resolveMigrationBlocker } from '../../../lib/migration-resolutions';

export const dynamic = 'force-dynamic';
const BASE_DOMAIN = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';
const PROTOCOL_VERSION = '2025-06-18';
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required, additionalProperties: false });
const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) });

const TOOLS = [
  { name: 'idb_status', description: 'InvisibleDB control-plane status.', inputSchema: obj({}) },
  { name: 'idb_list', description: 'List instances owned by this account.', inputSchema: obj({}) },
  { name: 'idb_provision', description: 'Provision a hosted InvisibleDB instance. Requires an active hosted entitlement.', inputSchema: obj({ name: str('URL-safe instance slug') }, ['name']) },
  { name: 'idb_keys', description: 'Get the secret destination instance key and SDK snippets. Never log this output.', inputSchema: obj({ instance: str() }, ['instance']) },
  { name: 'idb_query', description: 'Query a destination collection.', inputSchema: obj({ instance: str(), collection: str(), filter: str(), page: { type: 'integer', minimum: 1 }, perPage: { type: 'integer', minimum: 1, maximum: 200 } }, ['instance','collection']) },
  { name: 'idb_migration_manifest_spec', description: 'Get MigrationManifest v1.0 shape and Lovable/Supabase/Postgres read-only discovery SQL.', inputSchema: obj({}) },
  { name: 'idb_migration_plan', description: 'Compile a source manifest into a read-only compatibility plan.', inputSchema: obj({ instance: str(), manifest: { type: 'object', additionalProperties: true } }, ['instance','manifest']) },
  { name: 'idb_migration_create', description: 'Persist a reviewed migration job.', inputSchema: obj({ instance: str(), manifest: { type: 'object', additionalProperties: true } }, ['instance','manifest']) },
  { name: 'idb_migration_start', description: 'Queue a pre-migration destination snapshot.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_prepare', description: 'After snapshot completion, create destination schema, relations, and indexes.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_batch', description: 'Import an idempotent 1-500 row data batch.', inputSchema: obj({ instance: str(), migrationId: str(), batchKey: str(), collection: str(), records: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object', additionalProperties: true } }, checksum: str() }, ['instance','migrationId','batchKey','collection','records']) },
  { name: 'idb_migration_auth_batch', description: 'Import an idempotent 1-500 user identity batch.', inputSchema: obj({ instance: str(), migrationId: str(), batchKey: str(), collection: str(), users: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object', additionalProperties: true } } }, ['instance','migrationId','batchKey','users']) },
  { name: 'idb_migration_file', description: 'Stream one source storage object by signed HTTPS URL into a destination record.', inputSchema: obj({ instance: str(), migrationId: str(), collection: str(), sourceRecordId: str(), field: str(), filename: str(), sourceUrl: str(), expectedSha256: str() }, ['instance','migrationId','collection','sourceRecordId','field','filename','sourceUrl']) },
  { name: 'idb_migration_resolve', description: 'Resolve one active cutover blocker only with concrete evidence of the rewrite or fix.', inputSchema: obj({ instance: str(), migrationId: str(), blocker: str(), evidence: str() }, ['instance','migrationId','blocker','evidence']) },
  { name: 'idb_migration_verify', description: 'Verify migration evidence; returns VERIFIED, PARTIAL, or FAILED.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_cutover', description: 'Generate cutover configuration. Refuses unless evidence is VERIFIED.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_rollback', description: 'Queue restore from the pre-migration backup; explicit backup is optional when the snapshot filename was captured automatically.', inputSchema: obj({ instance: str(), migrationId: str(), backup: str() }, ['instance','migrationId']) },
  { name: 'idb_migration_status', description: 'Read one migration or recent migrations for an instance.', inputSchema: obj({ instance: str(), migrationId: str() }, ['instance']) },
];

const DISCOVERY = {
  manifest: { version: '1.0', source: { provider: 'lovable-cloud', engine: 'postgres', projectId: '<project>', capturedAt: '<ISO>' }, tables: [], auth: { provider: 'supabase-auth', usersCount: 0, passwordHashExportable: false, userTable: 'auth.users' }, storage: { buckets: [] }, functions: [], realtime: [], extensions: [], metadata: {} },
  sql: {
    relations: "select n.nspname as schema_name,c.relname as relation_name,case c.relkind when 'r' then 'table' when 'v' then 'view' when 'm' then 'materialized_view' end as kind,coalesce(s.n_live_tup,0)::bigint as row_count from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_stat_user_tables s on s.relid=c.oid where c.relkind in ('r','v','m') and n.nspname not in ('pg_catalog','information_schema') order by 1,2;",
    columns: "select table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name,ordinal_position;",
    primaryKeys: "select tc.table_schema,tc.table_name,kcu.column_name,kcu.ordinal_position from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema where tc.constraint_type='PRIMARY KEY' order by 1,2,4;",
    foreignKeys: "select tc.table_schema,tc.table_name,kcu.column_name,ccu.table_schema as foreign_table_schema,ccu.table_name as foreign_table_name,ccu.column_name as foreign_column_name,rc.delete_rule from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema join information_schema.referential_constraints rc on rc.constraint_name=tc.constraint_name and rc.constraint_schema=tc.table_schema where tc.constraint_type='FOREIGN KEY' order by 1,2;",
    indexes: "select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname not in ('pg_catalog','information_schema') order by 1,2,3;",
    policies: 'select schemaname,tablename,policyname,cmd,roles,qual,with_check from pg_policies order by schemaname,tablename,policyname;',
    triggers: "select event_object_schema,event_object_table,trigger_name,action_statement,action_timing,event_manipulation from information_schema.triggers where trigger_schema not in ('pg_catalog','information_schema') order by 1,2,3;",
    extensions: 'select extname from pg_extension order by extname;',
    functions: "select n.nspname as schema_name,p.proname as function_name,l.lanname as language from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname not in ('pg_catalog','information_schema') order by 1,2;",
    storageBuckets: 'select id,name,public,file_size_limit,allowed_mime_types from storage.buckets order by name;',
    storageCounts: "select bucket_id,count(*)::bigint as objects_count,coalesce(sum((metadata->>'size')::bigint),0)::bigint as bytes from storage.objects group by bucket_id order by bucket_id;"
  },
  rules: ['Do not invent missing schema facts.', 'Run idb_migration_plan before any destination mutation.', 'Paginate source rows and send at most 500 records per idb_migration_batch.', 'For source storage, stage metadata records with source_key=bucket/path and use signed HTTPS URLs for file transfer.', 'Use idb_migration_resolve only after producing concrete evidence for an active blocker.']
};

function rpc(id: unknown, result: unknown, status = 200) { return NextResponse.json({ jsonrpc: '2.0', id, result }, { status, headers: { 'Cache-Control': 'no-store' } }); }
function rpcError(id: unknown, code: number, message: string, data?: unknown, status = 200) { return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message, ...(data === undefined ? {} : { data }) } }, { status, headers: { 'Cache-Control': 'no-store' } }); }
function toolResult(payload: unknown, isError = false) { return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], ...(isError ? { isError: true } : {}) }; }

async function callTool(user: { id: string; email: string }, name: string, args: Record<string, any>) {
  const slug = String(args.instance || '');
  if (name !== 'idb_status' && name !== 'idb_list' && name !== 'idb_provision' && name !== 'idb_migration_manifest_spec') {
    if (!slug || !(await requireOwnedInstance(user.id, slug))) throw new Error('instance not found');
  }
  if (name === 'idb_status') return { ok: true, version: '0.2.0', instances: await prisma.provisionRequest.count({ where: { userId: user.id, kind: 'provision', status: 'done' } }) };
  if (name === 'idb_list') {
    const rows = await prisma.provisionRequest.findMany({ where: { userId: user.id, kind: 'provision' }, orderBy: { createdAt: 'desc' } }); const seen = new Set<string>();
    return rows.filter((r) => !seen.has(r.slug) && seen.add(r.slug)).map((r) => ({ id: r.id, name: r.slug, fqdn: `${r.slug}.${BASE_DOMAIN}`, status: r.status === 'done' ? 'ready' : r.status === 'failed' ? 'failed' : 'provisioning', plan: 'seat', createdAt: r.createdAt.toISOString() }));
  }
  if (name === 'idb_provision') {
    const instanceName = String(args.name || '').toLowerCase(); if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(instanceName)) throw new Error('invalid instance name');
    const entitlement = await prisma.billingSubscription.findFirst({ where: { userId: user.id, entitlementActive: true } }); if (!entitlement) throw new Error('active hosted entitlement required');
    const existing = await prisma.provisionRequest.findFirst({ where: { userId: user.id, slug: instanceName, kind: 'provision', status: { in: ['pending','claimed','done'] } }, orderBy: { createdAt: 'desc' } });
    const row = existing ?? await prisma.provisionRequest.create({ data: { kind: 'provision', userId: user.id, email: user.email, slug: instanceName } });
    return { id: row.id, name: row.slug, fqdn: `${row.slug}.${BASE_DOMAIN}`, status: row.status === 'done' ? 'ready' : 'provisioning', plan: 'seat', createdAt: row.createdAt.toISOString() };
  }
  if (name === 'idb_keys') {
    const credential = await prisma.instanceCredential.findUnique({ where: { userId_slug: { userId: user.id, slug } } }); if (!credential) throw new Error('management credential is still synchronizing');
    const apiKey = decryptSecret(credential.apiKeyEncrypted); const baseUrl = `https://${slug}.${BASE_DOMAIN}`;
    return { instanceId: slug, baseUrl, adminUrl: `${baseUrl}/_/`, apiKey, restSnippet: `curl -H 'Authorization: Bearer ${apiKey}' '${baseUrl}/api/collections'` };
  }
  if (name === 'idb_query') {
    const collection = String(args.collection || ''); if (!/^[A-Za-z0-9_-]+$/.test(collection)) throw new Error('valid collection required');
    const page = Math.max(1, Number(args.page || 1)); const perPage = Math.min(200, Math.max(1, Number(args.perPage || 30))); const query: Record<string,string> = { page: String(page), perPage: String(perPage) }; if (args.filter) query.filter = String(args.filter);
    const result = await instanceRequest<any>(user.id, slug, 'GET', `/api/collections/${collection}/records`, undefined, query);
    return { instanceId: slug, collection, items: result.items ?? [], totalItems: result.totalItems ?? 0, page: result.page ?? page, perPage: result.perPage ?? perPage };
  }
  if (name === 'idb_migration_manifest_spec') return DISCOVERY;
  if (name === 'idb_migration_plan') { assertMigrationManifest(args.manifest); return compileMigrationPlan(args.manifest); }
  if (name === 'idb_migration_create') return createMigration(user.id, slug, args.manifest);
  if (name === 'idb_migration_start') return queueMigrationSnapshot(user.id, slug, String(args.migrationId || ''));
  if (name === 'idb_migration_prepare') return prepareMigrationWithIndexes(user.id, slug, String(args.migrationId || ''));
  if (name === 'idb_migration_batch') return importMigrationBatch(user.id, slug, String(args.migrationId || ''), { batchKey: String(args.batchKey || ''), collection: String(args.collection || ''), records: args.records, checksum: args.checksum });
  if (name === 'idb_migration_auth_batch') return importAuthBatch(user.id, slug, String(args.migrationId || ''), { batchKey: String(args.batchKey || ''), collection: args.collection, users: args.users });
  if (name === 'idb_migration_file') return importMigrationFile(user.id, slug, String(args.migrationId || ''), { collection: String(args.collection || ''), sourceRecordId: String(args.sourceRecordId || ''), field: String(args.field || ''), filename: String(args.filename || ''), sourceUrl: String(args.sourceUrl || ''), expectedSha256: args.expectedSha256 });
  if (name === 'idb_migration_resolve') return resolveMigrationBlocker(user.id, slug, String(args.migrationId || ''), String(args.blocker || ''), String(args.evidence || ''));
  if (name === 'idb_migration_verify') return verifyMigration(user.id, slug, String(args.migrationId || ''));
  if (name === 'idb_migration_cutover') return cutoverMigration(user.id, slug, String(args.migrationId || ''));
  if (name === 'idb_migration_rollback') return rollbackMigration(user.id, slug, String(args.migrationId || ''), args.backup ? String(args.backup) : undefined);
  if (name === 'idb_migration_status') return migrationStatus(user.id, slug, args.migrationId ? String(args.migrationId) : undefined);
  throw new Error(`unknown tool: ${name}`);
}

export async function POST(req: Request) {
  const message = await req.json().catch(() => null) as any;
  if (!message || message.jsonrpc !== '2.0' || !message.method) return rpcError(message?.id ?? null, -32600, 'Invalid Request', undefined, 400);
  if (message.method === 'initialize') return rpc(message.id, { protocolVersion: message.params?.protocolVersion || PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'InvisibleDB', version: '0.2.0' }, instructions: 'Agent-native backend management and evidence-gated migrations. For Lovable migrations, call idb_migration_manifest_spec first.' });
  if (message.method === 'notifications/initialized') return new NextResponse(null, { status: 204 });
  const user = await apiUser(req); if (!user) return rpcError(message.id ?? null, -32001, 'Unauthorized', undefined, 401);
  if (message.method === 'tools/list') return rpc(message.id, { tools: TOOLS });
  if (message.method === 'tools/call') {
    const name = String(message.params?.name || ''); const args = (message.params?.arguments ?? {}) as Record<string, any>;
    try { return rpc(message.id, toolResult(await callTool(user, name, args))); }
    catch (error) { return rpc(message.id, toolResult({ error: error instanceof Error ? error.message : 'tool call failed' }, true)); }
  }
  return rpcError(message.id ?? null, -32601, 'Method not found');
}

export async function GET() { return NextResponse.json({ name: 'InvisibleDB MCP', transport: 'streamable-http', endpoint: '/api/mcp', protocolVersion: PROTOCOL_VERSION }, { headers: { 'Cache-Control': 'no-store' } }); }
