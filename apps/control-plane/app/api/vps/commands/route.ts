/**
 * Runtime command channel between the Vercel control plane and the VPS.
 * The VPS authenticates with VPS_API_SECRET and polls this endpoint.
 */
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { encryptSecret } from '../../../../lib/crypto';
import { prisma } from '../../../../lib/db';

function authorized(req: Request): boolean {
  const secret = process.env.VPS_API_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

const SAFE_TO_RETRY = ['status', 'logs', 'usage', 'sync_key'] as const;

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const claimed = await prisma.$transaction(async (tx) => {
    const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);

    await tx.runtimeCommand.updateMany({
      where: {
        status: 'claimed',
        updatedAt: { lt: staleCutoff },
        kind: { in: [...SAFE_TO_RETRY] },
      },
      data: { status: 'pending', claimedAt: null },
    });

    await tx.runtimeCommand.updateMany({
      where: {
        status: 'claimed',
        updatedAt: { lt: staleCutoff },
        kind: { notIn: [...SAFE_TO_RETRY] },
      },
      data: {
        status: 'failed',
        completedAt: new Date(),
        result: { error: 'worker stopped before reporting; command was not automatically repeated' },
      },
    });

    const pending = await tx.runtimeCommand.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    for (const command of pending) {
      await tx.runtimeCommand.update({
        where: { id: command.id },
        data: {
          status: 'claimed',
          claimedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    }

    return pending;
  });

  return NextResponse.json({
    commands: claimed.map((command) => ({
      id: command.id,
      slug: command.slug,
      kind: command.kind,
      payload: command.payload,
    })),
  });
}

/** POST { id, ok, result?, secret? } */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    id?: string;
    ok?: boolean;
    result?: unknown;
    secret?: string;
  };
  if (!body.id || typeof body.ok !== 'boolean') {
    return NextResponse.json({ error: 'id and ok are required' }, { status: 400 });
  }

  const command = await prisma.runtimeCommand.findUnique({ where: { id: body.id } });
  if (!command) return NextResponse.json({ error: 'command not found' }, { status: 404 });

  const result = body.result === undefined
    ? undefined
    : (body.result as Prisma.InputJsonValue);

  await prisma.runtimeCommand.update({
    where: { id: command.id },
    data: {
      status: body.ok ? 'done' : 'failed',
      result,
      secretResultEncrypted:
        body.secret && command.kind === 'rotate_key' ? encryptSecret(body.secret) : undefined,
      completedAt: new Date(),
    },
  });

  if (body.ok && body.secret && (command.kind === 'rotate_key' || command.kind === 'sync_key')) {
    await prisma.instanceCredential.upsert({
      where: { userId_slug: { userId: command.userId, slug: command.slug } },
      create: {
        userId: command.userId,
        slug: command.slug,
        apiKeyEncrypted: encryptSecret(body.secret),
      },
      update: { apiKeyEncrypted: encryptSecret(body.secret) },
    });
  }

  if (body.ok && command.kind === 'status' && result) {
    await prisma.instanceState.upsert({
      where: { userId_slug: { userId: command.userId, slug: command.slug } },
      create: {
        userId: command.userId,
        slug: command.slug,
        snapshot: result,
        observedAt: new Date(),
      },
      update: {
        snapshot: result,
        observedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
