import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/db';

const ALLOWED = new Set(['status', 'logs', 'usage', 'backup', 'restore', 'restart', 'rotate_key']);
const MUTATING = new Set(['backup', 'restore', 'restart', 'rotate_key']);

async function ownedInstance(userId: string, slug: string) {
  return prisma.provisionRequest.findFirst({
    where: { userId, slug, kind: 'provision', status: 'done' },
    orderBy: { createdAt: 'desc' },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await ownedInstance(user.id, slug))) {
    return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  }

  const [state, commands] = await Promise.all([
    prisma.instanceState.findUnique({ where: { userId_slug: { userId: user.id, slug } } }),
    prisma.runtimeCommand.findMany({
      where: { userId: user.id, slug },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        kind: true,
        status: true,
        payload: true,
        result: true,
        attempts: true,
        createdAt: true,
        completedAt: true,
        secretResultEncrypted: true,
      },
    }),
  ]);

  const stale = !state || Date.now() - state.observedAt.getTime() > 60_000;
  if (stale) {
    const existing = await prisma.runtimeCommand.findFirst({
      where: { userId: user.id, slug, kind: 'status', status: { in: ['pending', 'claimed'] } },
    });
    if (!existing) {
      await prisma.runtimeCommand.create({ data: { userId: user.id, slug, kind: 'status' } });
    }
  }

  return NextResponse.json({
    state: state ? { snapshot: state.snapshot, observedAt: state.observedAt } : null,
    commands: commands.map(({ secretResultEncrypted, ...command }) => ({
      ...command,
      hasSecret: Boolean(secretResultEncrypted),
    })),
    refreshQueued: stale,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { slug } = await params;
  if (!(await ownedInstance(user.id, slug))) {
    return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  }

  const body = (await req.json()) as { kind?: string; payload?: Record<string, unknown> };
  if (!body.kind || !ALLOWED.has(body.kind)) {
    return NextResponse.json({ error: 'unsupported command' }, { status: 400 });
  }

  const payload: Record<string, unknown> = { ...(body.payload ?? {}) };
  if (body.kind === 'logs') {
    const lines = Number(payload.lines ?? 200);
    payload.lines = Math.max(20, Math.min(500, Number.isFinite(lines) ? lines : 200));
  }
  if (body.kind === 'restore') {
    const backup = typeof payload.backup === 'string' ? payload.backup : '';
    const safe = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d{4}-\\d{2}-\\d{2}[^/]*\\.db\\.gz$`);
    if (!safe.test(backup)) {
      return NextResponse.json({ error: 'valid backup filename required' }, { status: 400 });
    }
  }

  if (MUTATING.has(body.kind)) {
    const active = await prisma.runtimeCommand.findFirst({
      where: { userId: user.id, slug, kind: body.kind, status: { in: ['pending', 'claimed'] } },
    });
    if (active) {
      return NextResponse.json({ id: active.id, status: active.status, deduplicated: true }, { status: 202 });
    }
  }

  const command = await prisma.runtimeCommand.create({
    data: {
      userId: user.id,
      slug,
      kind: body.kind,
      payload: Object.keys(payload).length ? (payload as Prisma.InputJsonValue) : undefined,
    },
  });

  return NextResponse.json({ id: command.id, status: command.status }, { status: 202 });
}
