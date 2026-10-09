import { z } from 'zod';
import type { GateName, InvisibleDBClient, MigrationAction } from './client.js';
import { POSTGRES_DISCOVERY } from './migration-discovery.js';

export const provisionSchema = {
  name: z.string().min(1).max(63).describe('URL-safe instance slug'),
  domain: z.string().optional(),
  plan: z.enum(['seat', 'dev']).optional(),
};
export type ProvisionArgs = z.infer<z.ZodObject<typeof provisionSchema>>;

export const keysSchema = { instance: z.string().min(1) };
export type KeysArgs = z.infer<z.ZodObject<typeof keysSchema>>;

export const querySchema = {
  instance: z.string().min(1),
  collection: z.string().min(1),
  filter: z.string().optional(),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().max(200).optional(),
};
export type QueryArgs = z.infer<z.ZodObject<typeof querySchema>>;

const gateNames = ['typecheck','unit-tests','integration-tests','security','migration-safety','production-readiness'] as const;
export const gateCheckSchema = { instance: z.string().min(1), gate: z.enum(gateNames) };
export type GateCheckArgs = z.infer<z.ZodObject<typeof gateCheckSchema>>;

const manifest = z.record(z.unknown()).describe('MigrationManifest v1.0 built from source discovery');
const migrationId = z.string().min(1).describe('Migration job id returned by idb_migration_create');
const instance = z.string().min(1).describe('Destination InvisibleDB instance slug');

function text(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

async function migrate(client: InvisibleDBClient, instanceName: string, action: MigrationAction, payload: Record<string, unknown> = {}) {
  return text(await client.migration(instanceName, action, payload));
}

export async function handleProvision(client: InvisibleDBClient, args: ProvisionArgs) {
  const inst = await client.provision({ name: args.name, domain: args.domain, plan: args.plan });
  return text({ ...inst, note: inst.status === 'provisioning' ? 'Poll idb_list until ready; provisioning is not success evidence.' : undefined });
}

export async function handleList(client: InvisibleDBClient) {
  const instances = await client.list();
  return text({ instances, count: instances.length });
}
export async function handleKeys(client: InvisibleDBClient, args: KeysArgs) { return text(await client.keys(args.instance)); }
export async function handleQuery(client: InvisibleDBClient, args: QueryArgs) { return text(await client.query(args.instance, args.collection, args.filter, { page: args.page, perPage: args.perPage })); }
export async function handleGateCheck(client: InvisibleDBClient, args: GateCheckArgs) {
  const result = await client.gateCheck(args.instance, args.gate as GateName);
  return text({ ...result, interpretation: result.state === 'VERIFIED' ? `Gate ${args.gate} passed.` : `Gate ${args.gate} is ${result.state}; treat as not-passed.` });
}
export async function handleStatus(client: InvisibleDBClient) { return text(await client.status()); }

export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (client: InvisibleDBClient, args: never) => Promise<unknown>;
}

export const tools: ToolDef[] = [
  { name: 'idb_provision', description: 'Provision a new InvisibleDB hosted instance.', schema: provisionSchema, handler: handleProvision as ToolDef['handler'] },
  { name: 'idb_list', description: 'List InvisibleDB instances.', schema: {}, handler: handleList as ToolDef['handler'] },
  { name: 'idb_keys', description: 'Get destination instance secret key/snippets. Do not log.', schema: keysSchema, handler: handleKeys as ToolDef['handler'] },
  { name: 'idb_query', description: 'Query a destination collection.', schema: querySchema, handler: handleQuery as ToolDef['handler'] },
  { name: 'idb_gate_check', description: 'Check a lifecycle gate. Only VERIFIED passes.', schema: gateCheckSchema, handler: handleGateCheck as ToolDef['handler'] },
  { name: 'idb_status', description: 'Control-plane health.', schema: {}, handler: handleStatus as ToolDef['handler'] },
  { name: 'idb_migration_manifest_spec', description: 'Get MigrationManifest v1.0 plus read-only Lovable/Supabase/Postgres discovery SQL with exact-count instructions.', schema: {}, handler: (async () => text(POSTGRES_DISCOVERY)) as ToolDef['handler'] },
  { name: 'idb_migration_plan', description: 'Compile a read-only compatibility plan.', schema: { instance, manifest }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'plan', { manifest: a.manifest })) as ToolDef['handler'] },
  { name: 'idb_migration_create', description: 'Persist a reviewed migration.', schema: { instance, manifest }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'create', { manifest: a.manifest })) as ToolDef['handler'] },
  { name: 'idb_migration_start', description: 'Queue the pre-migration snapshot.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'start', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_prepare', description: 'Create collections, relations, and compiled indexes after snapshot.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'prepare', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_batch', description: 'Import an idempotent 1-500 row data batch.', schema: { instance, migrationId, batchKey: z.string().regex(/^[A-Za-z0-9_-]+$/), collection: z.string().min(1), records: z.array(z.record(z.unknown())).min(1).max(500), checksum: z.string().optional() }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'batch', { migrationId: a.migrationId, batchKey: a.batchKey, collection: a.collection, records: a.records, checksum: a.checksum })) as ToolDef['handler'] },
  { name: 'idb_migration_auth_batch', description: 'Import 1-500 auth identities with explicit password-reset semantics.', schema: { instance, migrationId, batchKey: z.string().regex(/^[A-Za-z0-9_-]+$/), collection: z.string().optional(), users: z.array(z.record(z.unknown())).min(1).max(500) }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'auth_batch', { migrationId: a.migrationId, batchKey: a.batchKey, collection: a.collection, users: a.users })) as ToolDef['handler'] },
  { name: 'idb_migration_file', description: 'Transfer one signed-URL storage object source→InvisibleDB; bytes never enter model context and the server validates DNS/redirect targets.', schema: { instance, migrationId, collection: z.string().min(1), sourceRecordId: z.string().min(1), field: z.string().min(1), filename: z.string().min(1), sourceUrl: z.string().url(), expectedSha256: z.string().optional() }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'file', { migrationId: a.migrationId, collection: a.collection, sourceRecordId: a.sourceRecordId, field: a.field, filename: a.filename, sourceUrl: a.sourceUrl, expectedSha256: a.expectedSha256 })) as ToolDef['handler'] },
  { name: 'idb_migration_resolve', description: 'Resolve one active cutover blocker only after supplying concrete evidence of the rewrite/fix.', schema: { instance, migrationId, blocker: z.string().min(1), evidence: z.string().min(1).max(2000) }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'resolve', { migrationId: a.migrationId, blocker: a.blocker, evidence: a.evidence })) as ToolDef['handler'] },
  { name: 'idb_migration_verify', description: 'Verify exact source counts, imported ledger counts, live destination counts, attached files, failed batches, and unresolved blockers.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'verify', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_cutover', description: 'Generate cutover configuration only for VERIFIED migrations.', schema: { instance, migrationId }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'cutover', { migrationId: a.migrationId })) as ToolDef['handler'] },
  { name: 'idb_migration_rollback', description: 'Queue restore of the captured pre-migration backup. Pass backup only to override the captured snapshot.', schema: { instance, migrationId, backup: z.string().optional() }, handler: (async (c: InvisibleDBClient, a: any) => migrate(c, a.instance, 'rollback', { migrationId: a.migrationId, backup: a.backup })) as ToolDef['handler'] },
  { name: 'idb_migration_status', description: 'Read one or recent migrations.', schema: { instance, migrationId: z.string().optional() }, handler: (async (c: InvisibleDBClient, a: any) => text(await c.migrationStatus(a.instance, a.migrationId))) as ToolDef['handler'] },
];
