import { NextResponse } from 'next/server';
import { apiUser, requireOwnedInstance } from '../../../../../lib/api-auth';
import { compileMigrationPlan, assertMigrationManifest } from '../../../../../lib/migration-manifest';
import { createMigration, cutoverMigration, importAuthBatch, importMigrationBatch, importMigrationFile, migrationStatus, prepareMigration, queueMigrationSnapshot, rollbackMigration, verifyMigration } from '../../../../../lib/migrations';

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'migration request failed';
  const status = /not found/i.test(message) ? 404 : /unauthorized/i.test(message) ? 401 : /still running|requires VERIFIED|blocker|not accepting|status/i.test(message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await requireOwnedInstance(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  const id = new URL(req.url).searchParams.get('id') || undefined;
  try { return NextResponse.json(await migrationStatus(user.id, slug, id)); } catch (error) { return fail(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await requireOwnedInstance(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as Record<string, any>;
  try {
    switch (body.action) {
      case 'plan': assertMigrationManifest(body.manifest); return NextResponse.json(compileMigrationPlan(body.manifest));
      case 'create': return NextResponse.json(await createMigration(user.id, slug, body.manifest), { status: 201 });
      case 'start': return NextResponse.json(await queueMigrationSnapshot(user.id, slug, String(body.migrationId || '')), { status: 202 });
      case 'prepare': return NextResponse.json(await prepareMigration(user.id, slug, String(body.migrationId || '')));
      case 'batch': return NextResponse.json(await importMigrationBatch(user.id, slug, String(body.migrationId || ''), { batchKey: String(body.batchKey || ''), collection: String(body.collection || ''), records: body.records, checksum: body.checksum }));
      case 'auth_batch': return NextResponse.json(await importAuthBatch(user.id, slug, String(body.migrationId || ''), { batchKey: String(body.batchKey || ''), collection: body.collection, users: body.users }));
      case 'file': return NextResponse.json(await importMigrationFile(user.id, slug, String(body.migrationId || ''), { collection: String(body.collection || ''), sourceRecordId: String(body.sourceRecordId || ''), field: String(body.field || ''), filename: String(body.filename || ''), sourceUrl: String(body.sourceUrl || ''), expectedSha256: body.expectedSha256 }));
      case 'verify': return NextResponse.json(await verifyMigration(user.id, slug, String(body.migrationId || '')));
      case 'cutover': return NextResponse.json(await cutoverMigration(user.id, slug, String(body.migrationId || '')));
      case 'rollback': return NextResponse.json(await rollbackMigration(user.id, slug, String(body.migrationId || ''), body.backup));
      default: return NextResponse.json({ error: 'unsupported migration action' }, { status: 400 });
    }
  } catch (error) { return fail(error); }
}
