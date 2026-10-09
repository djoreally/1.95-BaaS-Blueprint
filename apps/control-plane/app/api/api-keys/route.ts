import { NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { issueApiKey } from '../../../lib/api-auth';
import { prisma } from '../../../lib/db';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const keys = await prisma.controlPlaneApiKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
  });
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { name?: string };
  const name = (body.name || 'Agent key').trim().slice(0, 80);
  const issued = issueApiKey();
  const key = await prisma.controlPlaneApiKey.create({
    data: { userId: user.id, name, prefix: issued.prefix, keyHash: issued.hash },
    select: { id: true, name: true, prefix: true, createdAt: true },
  });
  return NextResponse.json({ ...key, token: issued.token, warning: 'This token is shown once. Store it as a secret.' }, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const result = await prisma.controlPlaneApiKey.updateMany({
    where: { id: body.id, userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: result.count === 1 });
}
