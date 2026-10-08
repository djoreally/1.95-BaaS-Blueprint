/**
 * VPS provision-queue API — polled by bin/poll-provision on the box.
 * Auth: shared secret in the Authorization header (`Bearer <VPS_API_SECRET>`).
 * The VPS never sees Stripe; it only sees provision/deprovision jobs.
 */
import { NextResponse } from 'next/server';
import { encryptSecret } from '../../../../lib/crypto';
import { prisma } from '../../../../lib/db';

function authorized(req: Request): boolean {
  const secret = process.env.VPS_API_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const claimed = await prisma.$transaction(async (tx) => {
    const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
    await tx.provisionRequest.updateMany({
      where: { status: 'claimed', updatedAt: { lt: staleCutoff } },
      data: { status: 'pending' },
    });
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

/** POST — report a result: { id, ok, detail?, secret? } */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, ok, detail, secret } = (await req.json()) as {
    id?: string;
    ok?: boolean;
    detail?: string;
    secret?: string;
  };
  if (!id || typeof ok !== 'boolean') {
    return NextResponse.json({ error: 'id and ok are required' }, { status: 400 });
  }

  const request = await prisma.provisionRequest.findUnique({ where: { id } });
  if (!request) return NextResponse.json({ error: 'request not found' }, { status: 404 });

  await prisma.provisionRequest.update({
    where: { id },
    data: { status: ok ? 'done' : 'failed', result: detail ? { detail } : undefined },
  });

  if (ok && request.kind === 'provision' && request.userId && secret) {
    await prisma.instanceCredential.upsert({
      where: { userId_slug: { userId: request.userId, slug: request.slug } },
      create: {
        userId: request.userId,
        slug: request.slug,
        apiKeyEncrypted: encryptSecret(secret),
      },
      update: { apiKeyEncrypted: encryptSecret(secret) },
    });
  }

  if (ok && request.kind === 'deprovision' && request.userId) {
    await prisma.$transaction([
      prisma.instanceCredential.deleteMany({ where: { userId: request.userId, slug: request.slug } }),
      prisma.instanceState.deleteMany({ where: { userId: request.userId, slug: request.slug } }),
    ]);
  }

  if (!ok && request.attempts < 5) {
    await prisma.provisionRequest.update({ where: { id }, data: { status: 'pending' } });
  }

  return NextResponse.json({ ok: true });
}
