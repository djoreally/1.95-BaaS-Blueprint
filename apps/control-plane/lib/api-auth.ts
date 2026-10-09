import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './db';

export function hashApiKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function issueApiKey(): { token: string; prefix: string; hash: string } {
  const token = `idb_sk_${randomBytes(32).toString('base64url')}`;
  return { token, prefix: token.slice(0, 14), hash: hashApiKey(token) };
}

export async function apiUser(req: Request) {
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token.startsWith('idb_sk_')) return null;
  const key = await prisma.controlPlaneApiKey.findUnique({
    where: { keyHash: hashApiKey(token) },
    include: { user: true },
  });
  if (!key || key.revokedAt) return null;
  void prisma.controlPlaneApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return key.user;
}

export async function requireOwnedInstance(userId: string, slug: string, ready = true) {
  return prisma.provisionRequest.findFirst({
    where: {
      userId,
      slug,
      kind: 'provision',
      ...(ready ? { status: 'done' } : { status: { in: ['pending', 'claimed', 'done'] } }),
    },
    orderBy: { createdAt: 'desc' },
  });
}
