import { decryptSecret } from './crypto';
import { prisma } from './db';

const BASE_DOMAIN = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';

export class InstanceManagementUnavailable extends Error {}

async function managementKey(userId: string, slug: string) {
  const credential = await prisma.instanceCredential.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (!credential) {
    throw new InstanceManagementUnavailable('management credential is still synchronizing');
  }
  return decryptSecret(credential.apiKeyEncrypted);
}

function instanceUrl(slug: string, path: string, query?: Record<string, string>) {
  if (!path.startsWith('/api/')) throw new Error('instance path must begin with /api/');
  const url = new URL(`https://${slug}.${BASE_DOMAIN}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  return url;
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`instance ${response.status}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function instanceRequest<T>(
  userId: string,
  slug: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<T> {
  const key = await managementKey(userId, slug);
  const response = await fetch(instanceUrl(slug, path, query), {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  return readResponse<T>(response);
}

export async function instanceMultipartRequest<T>(
  userId: string,
  slug: string,
  method: 'POST' | 'PATCH',
  path: string,
  form: FormData,
): Promise<T> {
  const key = await managementKey(userId, slug);
  const response = await fetch(instanceUrl(slug, path), {
    method,
    headers: { authorization: `Bearer ${key}` },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  return readResponse<T>(response);
}
