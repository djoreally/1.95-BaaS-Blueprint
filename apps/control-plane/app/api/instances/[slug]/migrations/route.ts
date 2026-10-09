import { NextResponse } from 'next/server';
import { apiUser, requireOwnedInstance } from '../../../../../lib/api-auth';
import { runMigrationAction } from '../../../../../lib/migration-actions';

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
  try { return NextResponse.json(await runMigrationAction(user.id, slug, { action: 'status', migrationId: new URL(req.url).searchParams.get('id') || undefined })); }
  catch (error) { return fail(error); }
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await requireOwnedInstance(user.id, slug))) return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;
  try { return NextResponse.json(await runMigrationAction(user.id, slug, body), { status: body.action === 'create' ? 201 : body.action === 'start' ? 202 : 200 }); }
  catch (error) { return fail(error); }
}
