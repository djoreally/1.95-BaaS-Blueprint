import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { currentUser } from '../../../lib/auth';
import { listUserJobs, startUserProvisioning } from '../../../lib/user-projects';
import {
  getByohConnection,
  getPlatformConnection,
  hostedBaseDomain,
  normalizeHostingMode,
} from '../../../lib/hosting';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return NextResponse.json({
    projects: (await listUserJobs(user.id)).map((j) => ({
      id: j.id, name: j.name, fqdn: j.fqdn, port: j.port,
      status: j.status, seeded: !!j.seeded, createdAt: j.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const body = (await req.json()) as { name?: string; domain?: string };
  const jar = await cookies();
  const hostingMode = normalizeHostingMode(jar.get('baas_hosting_mode')?.value);
  const conn = hostingMode === 'HOSTED'
    ? await getPlatformConnection()
    : await getByohConnection(user.id);

  if (!conn) {
    return NextResponse.json(
      {
        error: hostingMode === 'HOSTED'
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
    return NextResponse.json({ error: 'Domain does not belong to your connected hosting account.' }, { status: 400 });
  }

  try {
    const job = await startUserProvisioning(user.id, name, domain, conn.id);
    return NextResponse.json({ id: job.id, hostingMode }, { status: 202 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
