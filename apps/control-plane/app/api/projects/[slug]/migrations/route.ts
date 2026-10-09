import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/db';
import { runMigrationAction } from '../../../../../lib/migration-actions';

async function owns(userId: string, slug: string) {
  return prisma.provisionRequest.findFirst({ where: { userId, slug, kind: 'provision', status: 'done' }, orderBy: { createdAt: 'desc' } });
}
function fail(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : 'migration request failed' }, { status: 400 }); }

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params; if (!(await owns(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  try { return NextResponse.json(await runMigrationAction(user.id, slug, { action: 'status', migrationId: new URL(req.url).searchParams.get('id') || undefined })); }
  catch (error) { return fail(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params; if (!(await owns(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  try { return NextResponse.json(await runMigrationAction(user.id, slug, body), { status: body.action === 'create' ? 201 : body.action === 'start' ? 202 : 200 }); }
  catch (error) { return fail(error); }
}
