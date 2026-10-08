/**
 * VPS provision-queue API — polled by bin/poll-provision on the box (cron, 2 min).
 * Auth: shared secret in the Authorization header (`Bearer <VPS_API_SECRET>`).
 * The VPS never sees Stripe; it only sees provision/deprovision jobs.
 */
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

function authorized(req: Request): boolean {
  const secret = process.env.VPS_API_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/** GET — claim up to 5 pending requests (claimed so two pollers can't double-run). */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const claimed = await prisma.$transaction(async (tx) => {
    const pending = await tx.provisionRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    for (const r of pending) {
      await tx.provisionRequest.update({
        where: { id: r.id },
        data: { status: 'claimed', attempts: { increment: 1 } },
      });
    }
    return pending;
  });
  return NextResponse.json({
    baseDomain: process.env.IDB_BASE_DOMAIN ?? null,
    requests: claimed.map((r) => ({ id: r.id, kind: r.kind, email: r.email, slug: r.slug })),
  });
}

/** POST — report a result: { id, ok, detail?, fqdn? } */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, ok, detail, fqdn } = (await req.json()) as { id?: string; ok?: boolean; detail?: string; fqdn?: string };
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const status = ok ? 'done' : 'failed';

  const provisionReq = await prisma.provisionRequest.findUnique({ where: { id } });

  await prisma.provisionRequest.update({
    where: { id },
    data: { status, result: detail ? { detail } : undefined },
  });

  // On successful provision, create the unified Project record (provider=vps).
  // This is what /projects displays — one instance model for both providers.
  if (ok && provisionReq && provisionReq.kind === 'provision' && provisionReq.userId) {
    const slug = provisionReq.slug;
    const instanceFqdn = fqdn || `${slug}.${process.env.IDB_BASE_DOMAIN || 'invisibledb.app'}`;
    await prisma.project.upsert({
      where: { id: `vps-${slug}` },
      update: { status: 'ready', fqdn: instanceFqdn, updatedAt: new Date() },
      create: {
        id: `vps-${slug}`,
        userId: provisionReq.userId,
        provider: 'vps',
        name: slug,
        domain: process.env.IDB_BASE_DOMAIN || 'invisibledb.app',
        fqdn: instanceFqdn,
        status: 'ready',
      },
    });
  }

  // On successful deprovision, mark the Project as deleted.
  if (ok && provisionReq && provisionReq.kind === 'deprovision' && provisionReq.userId) {
    await prisma.project.updateMany({
      where: { userId: provisionReq.userId, provider: 'vps', name: provisionReq.slug },
      data: { status: 'deleted' },
    });
  }

  // Failed provisions go back to pending for retry (max 5 attempts), then stay failed.
  if (!ok) {
    const r = await prisma.provisionRequest.findUnique({ where: { id } });
    if (r && r.attempts < 5) {
      await prisma.provisionRequest.update({ where: { id }, data: { status: 'pending' } });
    }
  }
  return NextResponse.json({ ok: true });
}
