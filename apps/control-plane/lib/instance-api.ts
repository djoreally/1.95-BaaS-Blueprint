import { decryptSecret } from './crypto';
import { prisma } from './db';

const BASE_DOMAIN = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';

export class InstanceManagementUnavailable extends Error {}

export async function instanceRequest<T>(
  userId: string,
  slug: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<T> {
  if (!path.startsWith('/api/')) throw new Error('instance path must begin with /api/');

  const credential = await prisma.instanceCredential.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (!credential) {
    throw new InstanceManagementUnavailable('management credential is still synchronizing');
  }

  const url = new URL(`https://${slug}.${BASE_DOMAIN}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${decryptSecret(credential.apiKeyEncrypted)}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`instance ${response.status}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
