/**
 * Hosting connection store — Prisma (Neon Postgres), server-side.
 *
 * Customer cPanel API tokens are AES-256-GCM encrypted at rest and only
 * decrypted in memory for server-side adapter calls.
 */
import { prisma } from './db';
import { encryptSecret, decryptSecret } from './crypto';

export interface HostingConnection {
  id: string;
  ownerUserId: string;
  host: string;
  user: string;
  apiToken: string;
  mainDomain: string;
  domains: string[];
  connectedAt: string;
}

async function getPlatformOwner() {
  const email = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase() || 'owner@local';
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Platform Owner' },
  });
}

function toConnection(row: {
  id: string;
  userId: string;
  host: string;
  username: string;
  apiTokenEncrypted: string;
  mainDomain: string | null;
  domains: string[];
  createdAt: Date;
}): HostingConnection {
  return {
    id: row.id,
    ownerUserId: row.userId,
    host: row.host,
    user: row.username,
    apiToken: decryptSecret(row.apiTokenEncrypted),
    mainDomain: row.mainDomain ?? '',
    domains: row.domains,
    connectedAt: row.createdAt.toISOString(),
  };
}

export async function getConnectionForUser(userId: string): Promise<HostingConnection | null> {
  const row = await prisma.hostingConnection.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return row ? toConnection(row) : null;
}

/**
 * Resolve a connection already bound to an owned project. Callers must verify
 * project ownership before using this function; it intentionally does not
 * require the connection owner to match the customer because HOSTED projects
 * are bound to the platform owner's connection.
 */
export async function getConnectionById(id: string): Promise<HostingConnection | null> {
  const row = await prisma.hostingConnection.findUnique({ where: { id } });
  return row ? toConnection(row) : null;
}

/** Existing platform cPanel connection used by managed HOSTED projects. */
export async function getConnection(): Promise<HostingConnection | null> {
  const owner = await getPlatformOwner();
  return getConnectionForUser(owner.id);
}

export async function setConnectionForUser(
  userId: string,
  c: Omit<HostingConnection, 'id' | 'ownerUserId'>,
): Promise<void> {
  const existing = await prisma.hostingConnection.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  const data = {
    userId,
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

/** Backward-compatible owner connection setter used by platform setup. */
export async function setConnection(c: Omit<HostingConnection, 'id' | 'ownerUserId'>): Promise<void> {
  const owner = await getPlatformOwner();
  await setConnectionForUser(owner.id, c);
}

export async function clearConnectionForUser(userId: string): Promise<void> {
  await prisma.hostingConnection.deleteMany({ where: { userId } });
}

export async function clearConnection(): Promise<void> {
  const owner = await getPlatformOwner();
  await clearConnectionForUser(owner.id);
}
