import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { instanceMultipartRequest, instanceRequest } from './instance-api';
import { assertMigrationManifest, compileMigrationPlan, type DestinationCollection, type MigrationManifest, type MigrationPlan } from './migration-manifest';

const IDENT = /^[A-Za-z0-9_-]+$/;

type JsonObject = Record<string, unknown>;

function json(value: unknown): Prisma.InputJsonValue { return value as Prisma.InputJsonValue; }

export function destinationId(table: string, sourceId: unknown): string {
  return createHash('sha256').update(`${table}\u0000${String(sourceId)}`).digest('hex').slice(0, 15);
}

async function ownedJob(userId: string, slug: string, id: string) {
  const job = await prisma.migrationJob.findFirst({ where: { id, userId, slug }, include: { batches: true } });
  if (!job) throw new Error('migration not found');
  return job;
}

function asManifest(value: Prisma.JsonValue): MigrationManifest {
  const manifest = value as unknown;
  assertMigrationManifest(manifest);
  return manifest;
}

function asPlan(value: Prisma.JsonValue): MigrationPlan { return value as unknown as MigrationPlan; }

export async function createMigration(userId: string, slug: string, manifestInput: unknown) {
  assertMigrationManifest(manifestInput);
  const manifest = manifestInput as MigrationManifest;
  const plan = compileMigrationPlan(manifest);
  return prisma.migrationJob.create({
    data: { userId, slug, sourceProvider: manifest.source.provider, status: 'planned', manifest: json(manifest), plan: json(plan), progress: json({ expectedRows: plan.collections.reduce((n, c) => n + (c.expectedRows ?? 0), 0), importedRows: 0 }) },
  });
}

export async function queueMigrationSnapshot(userId: string, slug: string, id: string) {
  const job = await ownedJob(userId, slug, id);
  if (!['planned', 'failed'].includes(job.status)) return job;
  const command = await prisma.runtimeCommand.create({ data: { userId, slug, kind: 'backup', payload: json({ reason: 'pre-migration', migrationId: id }) } });
  return prisma.migrationJob.update({
    where: { id },
    data: { status: 'snapshotting', startedAt: job.startedAt ?? new Date(), error: null, progress: json({ ...(job.progress as JsonObject ?? {}), snapshotCommandId: command.id }) },
  });
}

function pbField(field: DestinationCollection['fields'][number], collectionIds: Map<string, string>) {
  if (field.type === 'relation') {
    const target = field.relation?.collection || '';
    const collectionId = collectionIds.get(target);
    if (!collectionId) throw new Error(`destination relation target missing: ${target}`);
    return { name: field.name, type: 'relation', required: field.required, maxSelect: 1, collectionId, cascadeDelete: false };
  }
  if (field.type === 'select') return { name: field.name, type: 'select', required: field.required, values: field.options?.values ?? [], maxSelect: 1 };
  const type = field.type === 'bool' ? 'bool' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'json' ? 'json' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'file' ? 'file' : 'text';
  return { name: field.name, type, required: field.required };
}

export async function prepareMigration(userId: string, slug: string, id: string) {
  const job = await ownedJob(userId, slug, id);
  if (!['snapshotting', 'planned', 'failed'].includes(job.status)) return job;
  const plan = asPlan(job.plan);
  if (plan.blockers.length) throw new Error(`migration has ${plan.blockers.length} blocker(s); resolve or explicitly edit the manifest/plan before schema mutation`);

  const progress = (job.progress ?? {}) as JsonObject;
  const snapshotCommandId = typeof progress.snapshotCommandId === 'string' ? progress.snapshotCommandId : null;
  if (snapshotCommandId) {
    const command = await prisma.runtimeCommand.findUnique({ where: { id: snapshotCommandId } });
    if (!command || !['done', 'failed'].includes(command.status)) throw new Error('destination backup is still running');
    if (command.status === 'failed') throw new Error('destination backup failed; migration has not modified schema');
  }

  const existing = await instanceRequest<{ items?: Array<{ id: string; name: string }> }>(userId, slug, 'GET', '/api/collections', undefined, { page: '1', perPage: '200' });
  const collectionIds = new Map((existing.items ?? []).map((c) => [c.name, c.id]));

  for (const collection of plan.collections) {
    if (collectionIds.has(collection.name)) continue;
    const created = await instanceRequest<{ id: string; name: string }>(userId, slug, 'POST', '/api/collections', {
      name: collection.name,
      type: collection.type,
      fields: collection.fields.filter((f) => f.type !== 'relation').map((f) => pbField(f, collectionIds)),
      listRule: collection.rules.list,
      viewRule: collection.rules.view,
      createRule: collection.rules.create,
      updateRule: collection.rules.update,
      deleteRule: collection.rules.delete,
    });
    collectionIds.set(collection.name, created.id);
  }

  for (const collection of plan.collections) {
    if (!collection.fields.some((f) => f.type === 'relation')) continue;
    const collectionId = collectionIds.get(collection.name)!;
    await instanceRequest(userId, slug, 'PATCH', `/api/collections/${collectionId}`, {
      fields: collection.fields.map((f) => pbField(f, collectionIds)),
      listRule: collection.rules.list,
      viewRule: collection.rules.view,
      createRule: collection.rules.create,
      updateRule: collection.rules.update,
      deleteRule: collection.rules.delete,
    });
  }

  return prisma.migrationJob.update({ where: { id }, data: { status: 'schema_ready', progress: json({ ...progress, schemaPreparedAt: new Date().toISOString() }) } });
}

function transformRecord(collection: DestinationCollection, record: JsonObject): JsonObject {
  const sourcePk = collection.primaryKey;
  const pkValue = record[sourcePk];
  if (pkValue == null) throw new Error(`${collection.sourceTable}: record is missing primary key ${sourcePk}`);
  const out: JsonObject = { id: destinationId(collection.sourceTable, pkValue), _source_id: String(pkValue) };
  for (const field of collection.fields) {
    if (field.name === '_source_id') continue;
    const sourceName = field.relation ? field.relation.sourceColumn === field.relation.sourceColumn ? field.name : field.name : field.name;
    const original = Object.prototype.hasOwnProperty.call(record, sourceName) ? record[sourceName] : record[field.name];
    if (original == null) { if (!field.required) out[field.name] = null; continue; }
    if (field.type === 'relation' && field.relation) out[field.name] = destinationId(field.relation.sourceTable, original);
    else if (field.type === 'date') out[field.name] = new Date(String(original)).toISOString();
    else out[field.name] = original;
  }
  return out;
}

export async function importMigrationBatch(userId: string, slug: string, id: string, input: { batchKey: string; collection: string; records: JsonObject[]; checksum?: string }) {
  if (!input.batchKey || !IDENT.test(input.batchKey) || !IDENT.test(input.collection)) throw new Error('valid batchKey and collection are required');
  if (!Array.isArray(input.records) || input.records.length === 0 || input.records.length > 500) throw new Error('records must contain 1-500 rows');
  const job = await ownedJob(userId, slug, id);
  if (!['schema_ready', 'importing'].includes(job.status)) throw new Error(`migration is not accepting data batches in status ${job.status}`);
  const plan = asPlan(job.plan);
  const collection = plan.collections.find((c) => c.name === input.collection || c.sourceTable === input.collection);
  if (!collection) throw new Error(`collection not in migration plan: ${input.collection}`);
  const existing = await prisma.migrationBatch.findUnique({ where: { migrationId_batchKey: { migrationId: id, batchKey: input.batchKey } } });
  if (existing?.status === 'done') return { batch: existing, deduplicated: true };
  const batch = existing ?? await prisma.migrationBatch.create({ data: { migrationId: id, batchKey: input.batchKey, collection: collection.name, checksum: input.checksum, received: input.records.length, status: 'running' } });
  let imported = 0;
  try {
    for (const source of input.records) {
      const transformed = transformRecord(collection, source);
      const recordId = String(transformed.id);
      try {
        await instanceRequest(userId, slug, 'POST', `/api/collections/${collection.name}/records`, transformed);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/400|409|already exists|unique/i.test(message)) throw error;
        const patch = { ...transformed }; delete patch.id;
        await instanceRequest(userId, slug, 'PATCH', `/api/collections/${collection.name}/records/${recordId}`, patch);
      }
      imported += 1;
    }
    const done = await prisma.migrationBatch.update({ where: { id: batch.id }, data: { status: 'done', imported } });
    const aggregates = await prisma.migrationBatch.aggregate({ where: { migrationId: id, status: 'done' }, _sum: { imported: true } });
    await prisma.migrationJob.update({ where: { id }, data: { status: 'importing', progress: json({ ...(job.progress as JsonObject ?? {}), importedRows: aggregates._sum.imported ?? imported, lastBatchAt: new Date().toISOString() }) } });
    return { batch: done, deduplicated: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.migrationBatch.update({ where: { id: batch.id }, data: { status: 'failed', imported, error: message } });
    await prisma.migrationJob.update({ where: { id }, data: { status: 'failed', error: message } });
    throw error;
  }
}

export async function importAuthBatch(userId: string, slug: string, id: string, input: { batchKey: string; collection?: string; users: Array<Record<string, unknown>> }) {
  const job = await ownedJob(userId, slug, id);
  const plan = asPlan(job.plan);
  const authCollection = plan.collections.find((c) => c.type === 'auth' && (!input.collection || c.name === input.collection || c.sourceTable === input.collection));
  if (!authCollection) throw new Error('auth collection not found in migration plan');
  const records = input.users.map((user) => ({ ...user, password: randomBytes(24).toString('base64url'), passwordConfirm: undefined, migration_reset_required: true }));
  return importMigrationBatch(userId, slug, id, { batchKey: input.batchKey, collection: authCollection.name, records });
}

function safeSourceUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('sourceUrl must use https');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^10\.|^192\.168\.|^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error('private-network sourceUrl is not allowed');
  return url;
}

export async function importMigrationFile(userId: string, slug: string, id: string, input: { collection: string; sourceRecordId: string; field: string; filename: string; sourceUrl: string; expectedSha256?: string }) {
  const job = await ownedJob(userId, slug, id);
  if (!['schema_ready', 'importing'].includes(job.status)) throw new Error('migration is not accepting files');
  const plan = asPlan(job.plan);
  const collection = plan.collections.find((c) => c.name === input.collection || c.sourceTable === input.collection);
  if (!collection) throw new Error('collection not found in migration plan');
  const url = safeSourceUrl(input.sourceUrl);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`source file download failed: ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 25 * 1024 * 1024) throw new Error('source file exceeds 25 MB migration limit');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error('source file exceeds 25 MB migration limit');
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (input.expectedSha256 && digest !== input.expectedSha256.toLowerCase()) throw new Error('source file checksum mismatch');
  const recordId = destinationId(collection.sourceTable, input.sourceRecordId);
  const form = new FormData();
  form.set(input.field, new Blob([bytes], { type: response.headers.get('content-type') || 'application/octet-stream' }), input.filename);
  const result = await instanceMultipartRequest(userId, slug, 'PATCH', `/api/collections/${collection.name}/records/${recordId}`, form);
  return { ok: true, sha256: digest, bytes: bytes.byteLength, result };
}

export async function verifyMigration(userId: string, slug: string, id: string) {
  const job = await ownedJob(userId, slug, id);
  const plan = asPlan(job.plan);
  const batches = job.batches;
  const failed = batches.filter((b) => b.status === 'failed');
  const byCollection = new Map<string, number>();
  for (const batch of batches.filter((b) => b.status === 'done')) byCollection.set(batch.collection, (byCollection.get(batch.collection) ?? 0) + batch.imported);
  const checks = plan.collections.map((c) => ({ collection: c.name, expected: c.expectedRows, imported: byCollection.get(c.name) ?? 0, exact: c.expectedRows == null ? true : c.expectedRows === (byCollection.get(c.name) ?? 0) }));
  const exact = checks.every((c) => c.exact) && failed.length === 0 && plan.blockers.length === 0;
  const verification = { state: exact ? 'VERIFIED' : 'FAILED', checkedAt: new Date().toISOString(), checks, failedBatches: failed.map((b) => b.batchKey), blockers: plan.blockers };
  return prisma.migrationJob.update({ where: { id }, data: { status: exact ? 'verified' : 'failed', verification: json(verification), error: exact ? null : 'migration verification failed' } });
}

export async function cutoverMigration(userId: string, slug: string, id: string) {
  const job = await ownedJob(userId, slug, id);
  const verification = job.verification as JsonObject | null;
  if (!verification || verification.state !== 'VERIFIED' || job.status !== 'verified') throw new Error('cutover requires VERIFIED migration evidence');
  const baseDomain = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';
  const result = { baseUrl: `https://${slug}.${baseDomain}`, env: { INVISIBLED_BASE_URL: `https://${slug}.${baseDomain}` }, instructions: ['Replace source backend environment variables with the InvisibleDB endpoint/key.', 'Switch application reads/writes only after smoke tests pass.', 'Keep the source backend read-only during the rollback window.'] };
  const updated = await prisma.migrationJob.update({ where: { id }, data: { status: 'cutover', completedAt: new Date(), progress: json({ ...(job.progress as JsonObject ?? {}), cutover: result }) } });
  return { job: updated, cutover: result };
}

export async function rollbackMigration(userId: string, slug: string, id: string, backup?: string) {
  const job = await ownedJob(userId, slug, id);
  if (!backup) throw new Error('rollback requires the pre-migration backup filename returned by the runtime backup command');
  if (!new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}[^/]*\\.db\\.gz$`).test(backup)) throw new Error('invalid backup filename');
  const command = await prisma.runtimeCommand.create({ data: { userId, slug, kind: 'restore', payload: json({ backup, reason: 'migration-rollback', migrationId: id }) } });
  const updated = await prisma.migrationJob.update({ where: { id }, data: { status: 'rolling_back', progress: json({ ...(job.progress as JsonObject ?? {}), rollbackCommandId: command.id }) } });
  return { job: updated, commandId: command.id };
}

export async function migrationStatus(userId: string, slug: string, id?: string) {
  if (id) return ownedJob(userId, slug, id);
  return prisma.migrationJob.findMany({ where: { userId, slug }, orderBy: { createdAt: 'desc' }, take: 20, include: { batches: true } });
}
