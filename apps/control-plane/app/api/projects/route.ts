import { NextResponse } from 'next/server';
import { listJobs, startProvisioning } from '../../../lib/projects';
import {
  getByohConnection,
  getPlatformConnection,
  hostedBaseDomain,
  normalizeHostingMode,
} from '../../../lib/hosting';

export async function GET() {
  return NextResponse.json({
    projects: (await listJobs()).map((j) => ({
      id: j.id, name: j.name, fqdn: j.fqdn, port: j.port,
      status: j.status, seeded: !!j.seeded, createdAt: j.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name?: string;
    domain?: string;
    hostingMode?: string;
  };
  const hostingMode = normalizeHostingMode(body.hostingMode);
  const conn = hostingMode === 'HOSTED' ? await getPlatformConnection() : await getByohConnection();

  if (!conn) {
    return NextResponse.json(
      {
        error:
          hostingMode === 'HOSTED'
            ? 'Managed hosting is not configured.'
            : 'Connect hosting first (POST /api/connect).',
      },
      { status: 409 },
    );
  }

  const name = body.name?.trim().toLowerCase();
  const domain = hostingMode === 'HOSTED' ? hostedBaseDomain(conn) : body.domain?.trim();

  if (!name || !domain) {
    return NextResponse.json({ error: 'name and domain are required' }, { status: 400 });
  }

  if (hostingMode === 'BYOH' && !conn.domains.includes(domain) && domain !== conn.mainDomain) {
    return NextResponse.json({ error: 'Domain does not belong to the connected hosting account.' }, { status: 400 });
  }

  try {
    const job = await startProvisioning(name, domain);
    return NextResponse.json({ id: job.id, hostingMode }, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
