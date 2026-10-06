/**
 * Hosting connection store — Prisma (Neon Postgres), server-side.
 *
 * The control plane authenticates to the customer's cPanel with an API
 * token (NEVER a password). The token is AES-256-GCM encrypted at rest
 * (see lib/crypto.ts) and only decrypted in memory for the API call.
 *
 * Auth is currently stubbed, so all connections attach to a single
 * default user. When real auth lands, scope by the session user.
 */
import { prisma } from './db';
import { encryptSecret, decryptSecret } from './crypto';

export interface HostingConnection {
  host: string;
  user: string;
  apiToken: string;
  mainDomain: string;
  domains: string[];
  connectedAt: string;
}

/** Single-user stand-in until real auth exists. */
async function getDefaultUser() {
  return prisma.user.upsert({
    where: { email: 'owner@local' },
    update: {},
    create: { email: 'owner@local', name: 'Owner' },
  });
}

export async function getConnection(): Promise<HostingConnection | null> {
  const user = await getDefaultUser();
  const row = await prisma.hostingConnection.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return null;
  return {
    host: row.host,
    user: row.username,
    apiToken: decryptSecret(row.apiTokenEncrypted),
    mainDomain: row.mainDomain ?? '',
    domains: row.domains,
    connectedAt: row.createdAt.toISOString(),
  };
}

export async function setConnection(c: HostingConnection): Promise<void> {
  const user = await getDefaultUser();
  const existing = await prisma.hostingConnection.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  const data = {
    userId: user.id,
    host: c.host,
    username: c.user,
    apiTokenEncrypted: encryptSecret(c.apiToken),
    mainDomain: c.mainDomain || null,
    domains: c.domains,
  };
  if (existing) {
    await prisma.hostingConnection.update({ where: { id: existing.id }, data });
  } else {
    await prisma.hostingConnection.create({ data });
  }
}

export async function clearConnection(): Promise<void> {
  const user = await getDefaultUser();
  await prisma.hostingConnection.deleteMany({ where: { userId: user.id } });
}
