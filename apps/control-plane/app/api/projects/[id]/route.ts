import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { getUserJob, teardownUserProject } from '../../../../lib/user-projects';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { id } = await params;
  const job = await getUserJob(user.id, id);
  if (!job) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { dbPassword: _pw, ...rest } = job;
  return NextResponse.json({ ...rest, hasDbPassword: !!job.dbPassword });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { id } = await params;
  try {
    const report = await teardownUserProject(user.id, id);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
