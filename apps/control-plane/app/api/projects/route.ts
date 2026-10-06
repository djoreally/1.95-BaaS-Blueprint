import { NextResponse } from 'next/server';
import { listJobs, startProvisioning } from '../../../lib/projects';
import { getConnection } from '../../../lib/connection';

export async function GET() {
  const conn = await getConnection();
  return NextResponse.json({
    connected: !!conn,
    host: conn?.host ?? null,
    projects: (await listJobs()).map((j) => ({
      id: j.id, name: j.name, fqdn: j.fqdn, port: j.port,
      status: j.status, seeded: !!j.seeded, createdAt: j.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const conn = await getConnection();
  if (!conn) {
    return NextResponse.json({ error: 'Connect hosting first (POST /api/connect).' }, { status: 409 });
  }
  const { name, domain } = (await req.json()) as { name?: string; domain?: string };
  if (!name || !domain) {
    return NextResponse.json({ error: 'name and domain are required' }, { status: 400 });
  }
  try {
    const job = await startProvisioning(name.trim().toLowerCase(), domain);
    return NextResponse.json({ id: job.id }, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
