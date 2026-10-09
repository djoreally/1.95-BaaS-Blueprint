import { z } from 'zod';
import type { GateName, InvisibleDBClient, MigrationAction } from './client.js';

export const provisionSchema = { name: z.string().min(1).max(63).describe('URL-safe instance slug'), domain: z.string().optional(), plan: z.enum(['seat', 'dev']).optional() };
export type ProvisionArgs = z.infer<z.ZodObject<typeof provisionSchema>>;
export const keysSchema = { instance: z.string().min(1) };
export type KeysArgs = z.infer<z.ZodObject<typeof keysSchema>>;
export const querySchema = { instance: z.string().min(1), collection: z.string().min(1), filter: z.string().optional(), page: z.number().int().positive().optional(), perPage: z.number().int().positive().max(200).optional() };
export type QueryArgs = z.infer<z.ZodObject<typeof querySchema>>;
const gateNames = ['typecheck','unit-tests','integration-tests','security','migration-safety','production-readiness'] as const;
export const gateCheckSchema = { instance: z.string().min(1), gate: z.enum(gateNames) };
export type GateCheckArgs = z.infer<z.ZodObject<typeof gateCheckSchema>>;

const manifest = z.record(z.unknown()).describe('MigrationManifest v1.0 built from source backend discovery');
const migrationId = z.string().min(1).describe('Migration job id returned by idb_migration_create');
const instance = z.string().min(1).describe('Destination InvisibleDB instance slug');

function text(payload: unknown) { return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] }; }
async function migrate(client: InvisibleDBClient, instanceName: string, action: MigrationAction, payload: Record<string, unknown> = {}) { return text(await client.migration(instanceName, action, payload)); }

export async function handleProvision(client: InvisibleDBClient, args: ProvisionArgs) {
  const inst = await client.provision({ name: args.name, domain: args.domain, plan: args.plan });
  return text({ ...inst, note: inst.status === 'provisioning' ? 'Poll idb_list until ready; provisioning is not success evidence.' : undefined });
}
export async function handleList(client: InvisibleDBClient) { const instances = await client.list(); return text({ instances, count: instances.length }); }
export async function handleKeys(client: InvisibleDBClient, args: KeysArgs) { return text(await client.keys(args.instance)); }
export async function handleQuery(client: InvisibleDBClient, args: QueryArgs) { return text(await client.query(args.instance, args.collection, args.filter, { page: args.page, perPage: args.perPage })); }
export async function handleGateCheck(client: InvisibleDBClient, args: GateCheckArgs) {
  const result = await client.gateCheck(args.instance, args.gate as GateName);
  const interpretation = result.state === 'VERIFIED' ? `Gate ${args.gate} passed.` : `Gate ${args.gate} is ${result.state}; treat as not-passed.`;
  return text({ ...result, interpretation });
}
export async function handleStatus(client: InvisibleDBClient) { return text(await client.status()); }

const POSTGRES_DISCOVERY = {
  instructions: [
    'Run these read-only queries through the Lovable/Supabase/Postgres source connector.',
    'Assemble the returned facts into MigrationManifest v1.0. Do not invent missing schema facts.',
    'Include auth.users as a table only when the source connector is authorized to read it; set auth.userTable accordingly.',
    'Run idb_migration_plan before creating or mutating the destination.'
  ],
  sql: {
    tables: `select n.nspname as schema_name,c.relname as table_name,coalesce(s.n_live_tup,0)::bigint as row_count from pg_class c join pg_namespace n on n.oid=c.relnamespace left join pg_stat_user_tables s on s.relid=c.oid where c.relkind='r' and n.nspname not in ('pg_catalog','information_schema') order by 1,2;`,
    columns: `select table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default,ordinal_position from information_schema.columns where table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name,ordinal_position;`,
    primaryKeys: `select tc.table_schema,tc.table_name,kcu.column_name,kcu.ordinal_position from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema where tc.constraint_type='PRIMARY KEY' order by 1,2,4;`,
    foreignKeys: `select tc.table_schema,tc.table_name,kcu.column_name,ccu.table_schema as foreign_table_schema,ccu.table_name as foreign_table_name,ccu.column_name as foreign_column_name,rc.delete_rule from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name and ccu.table_schema=tc.table_schema join information_schema.referential_constraints rc on rc.constraint_name=tc.constraint_name and rc.constraint_schema=tc.table_schema where tc.constraint_type='FOREIGN KEY' order by 1,2;`,
    policies: `select schemaname,tablename,policyname,cmd,roles,qual,with_check from pg_policies order by schemaname,tablename,policyname;`,
    triggers: `select event_object_schema,event_object_table,trigger_name,action_statement,action_timing,event_manipulation from information_schema.triggers where trigger_schema not in ('pg_catalog','information_schema') order by 1,2,3;`,
    extensions: `select extname from pg_extension order by extname;`,
    functions: `select n.nspname as schema_name,p.proname as function_name,l.lanname as language from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname not in ('pg_catalog','information_schema') order by 1,2;`
  },
  manifestShape: {
    version: '1.0',
    source: { provider: 'lovable-cloud', engine: 'postgres', projectId: '<source project id>', capturedAt: '<ISO timestamp>' },
    tables: [{ name: 'public.example', rowCount: 0, primaryKey: ['id'], columns: [{ name: 'id', sourceType: 'uuid', nullable: false }], foreignKeys: [], indexes: [], policies: [], triggers: [] }],
    auth: { provider: 'supabase-auth', usersCount: 0, passwordHashExportable: false, userTable: 'auth.users' },
    storage: { buckets: [] }, functions: [], realtime: [], extensions: [], metadata: {}
  }
};

export interface ToolDef { name: string; description: string; schema: Record<string, z.ZodTypeAny>; handler: (client: InvisibleDBClient, args: never) => Promise<unknown> }

export const tools: ToolDef[] = [
  { name: 'idb_provision', description: 'Provision a new InvisibleDB hosted instance.', schema: provisionSchema, handler: handleProvision as ToolDef['handler'] },
  { name: 'idb_list', description: 'List InvisibleDB instances and provisioning status.', schema: {}, handler: handleList as ToolDef['handler'] },
  { name: 'idb_keys', description: 'Get destination instance API keys and snippets. Secret: do not log or paste outside the active operator session.', schema: keysSchema, handler: handleKeys as ToolDef['handler'] },
  { name: 'idb_query', description: 'Query a destination PocketBase collection.', schema: querySchema, handler: handleQuery as ToolDef['handler'] },
  { name: 'idb_gate_check', description: 'Check a lifecycle gate. Only VERIFIED passes.', schema: gateCheckSchema, handler: handleGateCheck as ToolDef['handler'] },
  { name: 'idb_status', description: 'Control-plane health and instance count.', schema: {}, handler: handleStatus as ToolDef['handler'] },
  { name: 'idb_migration_manifest_spec', description: 'Return the provider-neutral MigrationManifest v1.0 shape plus read-only Postgres/Lovable discovery SQL. Use this first when migrating from Lovable/Supabase/Postgres.', schema: {}, handler: (async () => text(POSTGRES_DISCOVERY)) as ToolDef['handler'] },
  { name: 'idb_migration_plan', description: 'Compile a source manifest into an InvisibleDB compatibility plan. Read-only: does not mutate the destination.', schema: { instance, manifest }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'plan', { manifest: a.manifest })) as ToolDef['handler'] },
  { name: 'idb_migration_create', description: 'Persist a migration job after reviewing idb_migration_plan.', schema: { instance, manifest }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'create', { manifest: a.manifest })) as ToolDef['handler'] },
  { name: 'idb_migration_start', description: 'Start migration safety workflow by queuing a restorable destination snapshot. Does not yet change schema.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'start', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_prepare', description: 'After the snapshot completes, create destination collections and relationships. Untranslated rules stay locked; blockers prevent cutover, not staging.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'prepare', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_batch', description: 'Import an idempotent data batch. Send 1-500 records. The agent should paginate at the source instead of sending an entire database in one tool call.', schema: { instance, migrationId, batchKey: z.string().regex(/^[A-Za-z0-9_-]+$/), collection: z.string().min(1), records: z.array(z.record(z.unknown())).min(1).max(500), checksum: z.string().optional() }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'batch', { migrationId: a.migrationId, batchKey: a.batchKey, collection: a.collection, records: a.records, checksum: a.checksum })) as ToolDef['handler'] },
  { name: 'idb_migration_auth_batch', description: 'Import 1-500 source auth identities. Password hashes are never copied into normal fields; the result states when password reset is required.', schema: { instance, migrationId, batchKey: z.string().regex(/^[A-Za-z0-9_-]+$/), collection: z.string().optional(), users: z.array(z.record(z.unknown())).min(1).max(500) }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'auth_batch', { migrationId: a.migrationId, batchKey: a.batchKey, collection: a.collection, users: a.users })) as ToolDef['handler'] },
  { name: 'idb_migration_file', description: 'Transfer one storage object directly from a signed HTTPS source URL into the destination record. Bytes do not pass through the LLM.', schema: { instance, migrationId, collection: z.string().min(1), sourceRecordId: z.string().min(1), field: z.string().min(1), filename: z.string().min(1), sourceUrl: z.string().url(), expectedSha256: z.string().optional() }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'file', { migrationId: a.migrationId, collection: a.collection, sourceRecordId: a.sourceRecordId, field: a.field, filename: a.filename, sourceUrl: a.sourceUrl, expectedSha256: a.expectedSha256 })) as ToolDef['handler'] },
  { name: 'idb_migration_verify', description: 'Verify imported counts, failed batches and unresolved blockers. Returns VERIFIED, PARTIAL or FAILED evidence.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'verify', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_cutover', description: 'Return cutover configuration only when migration evidence is VERIFIED. Refuses PARTIAL/FAILED/UNKNOWN migrations.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'cutover', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_rollback', description: 'Queue restore of the pre-migration InvisibleDB backup.', schema: { instance, migrationId, backup: z.string().min(1) }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'rollback', { migrationId: a.migrationId, backup: a.backup })) as ToolDef['handler'] },
  { name: 'idb_migration_status', description: 'Read one migration job or recent migration jobs for an instance.', schema: { instance, migrationId: z.string().optional() }, handler: (async (c: InvisibleDBClient, a: any) => text(await c.migrationStatus(a.instance, a.migrationId))) as ToolDef['handler'] },
];
