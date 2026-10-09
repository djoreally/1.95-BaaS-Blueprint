import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/db';
import { compileMigrationPlan, assertMigrationManifest } from '../../../../../lib/migration-manifest';
import { createMigration, cutoverMigration, importAuthBatch, importMigrationBatch, importMigrationFile, migrationStatus, prepareMigration, queueMigrationSnapshot, rollbackMigration, verifyMigration } from '../../../../../lib/migrations';

async function owns(userId: string, slug: string) {
  return prisma.provisionRequest.findFirst({ where: { userId, slug, kind: 'provision', status: 'done' }, orderBy: { createdAt: 'desc' } });
}
function fail(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : 'migration request failed' }, { status: 400 }); }

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params; if (!(await owns(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  try { return NextResponse.json(await migrationStatus(user.id, slug, new URL(req.url).searchParams.get('id') || undefined)); } catch (error) { return fail(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params; if (!(await owns(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
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
