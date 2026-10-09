import { NextResponse } from 'next/server';
import { apiUser } from '../../../lib/api-auth';
import { prisma } from '../../../lib/db';

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const BASE_DOMAIN = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';

export async function GET(req: Request) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rows = await prisma.provisionRequest.findMany({
    where: { userId: user.id, kind: 'provision' },
    orderBy: { createdAt: 'desc' },
  });
  const seen = new Set<string>();
  const instances = rows.filter((row) => !seen.has(row.slug) && seen.add(row.slug)).map((row) => ({
    id: row.id,
    name: row.slug,
    fqdn: `${row.slug}.${BASE_DOMAIN}`,
    status: row.status === 'done' ? 'ready' : row.status === 'failed' ? 'failed' : 'provisioning',
    plan: 'seat',
    createdAt: row.createdAt.toISOString(),
  }));
  return NextResponse.json(instances);
}

export async function POST(req: Request) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { name?: string; domain?: string; plan?: string };
  const name = (body.name || '').trim().toLowerCase();
  if (!SLUG.test(name)) return NextResponse.json({ error: 'invalid instance name' }, { status: 400 });
  if (body.plan === 'dev') return NextResponse.json({ error: 'dev/BYOH provisioning is not available on the VPS-only platform' }, { status: 410 });
  if (body.domain && body.domain !== BASE_DOMAIN) return NextResponse.json({ error: 'custom provisioning domains are not supported by this endpoint yet' }, { status: 400 });
  const entitlement = await prisma.billingSubscription.findFirst({ where: { userId: user.id, entitlementActive: true } });
  if (!entitlement) return NextResponse.json({ error: 'active hosted entitlement required' }, { status: 402 });
  const existing = await prisma.provisionRequest.findFirst({
    where: { userId: user.id, slug: name, kind: 'provision', status: { in: ['pending', 'claimed', 'done'] } },
    orderBy: { createdAt: 'desc' },
  });
  const row = existing ?? await prisma.provisionRequest.create({
    data: { kind: 'provision', userId: user.id, email: user.email, slug: name },
  });
  return NextResponse.json({
    id: row.id,
    name: row.slug,
    fqdn: `${row.slug}.${BASE_DOMAIN}`,
    status: row.status === 'done' ? 'ready' : 'provisioning',
    plan: 'seat',
    createdAt: row.createdAt.toISOString(),
  }, { status: existing ? 200 : 202 });
}
