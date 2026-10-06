import { NextResponse } from 'next/server';
import { getJob, teardownProject } from '../../../../lib/projects';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  // Never leak the DB password over the poll endpoint; the dashboard fetches
  // it from the server-rendered page instead.
  const { dbPassword: _pw, ...rest } = job;
  return NextResponse.json({ ...rest, hasDbPassword: !!job.dbPassword });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const report = await teardownProject(id);
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
