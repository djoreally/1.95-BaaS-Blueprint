import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { prisma } from './db';
import { destinationId } from './migrations';
import { instanceMultipartRequest } from './instance-api';
import type { MigrationPlan } from './migration-manifest';

type JsonObject = Record<string, unknown>;
const MAX_BYTES = 25 * 1024 * 1024;

function privateIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function privateAddress(address: string): boolean {
  const value = address.toLowerCase().split('%')[0];
  if (isIP(value) === 4) return privateIPv4(value);
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return privateIPv4(mapped);
  }
  if (isIP(value) !== 6) return true;
  return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value);
}

async function assertPublicHttps(url: URL) {
  if (url.protocol !== 'https:') throw new Error('sourceUrl must use https');
  if (url.username || url.password) throw new Error('sourceUrl credentials are not allowed');
  if (url.port && url.port !== '443') throw new Error('sourceUrl must use the standard HTTPS port');
  const literal = isIP(url.hostname);
  if (literal && privateAddress(url.hostname)) throw new Error('private-network sourceUrl is not allowed');
  if (!literal) {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error('sourceUrl resolves to a private or unsafe network address');
  }
}

async function fetchPublicFile(input: string): Promise<Response> {
  let url = new URL(input);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertPublicHttps(url);
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('source file redirect did not include a location');
    url = new URL(location, url);
  }
  throw new Error('source file exceeded the redirect limit');
}

export async function importMigrationFileSafe(userId: string, slug: string, migrationId: string, input: { collection: string; sourceRecordId: string; field: string; filename: string; sourceUrl: string; expectedSha256?: string }) {
  const job = await prisma.migrationJob.findFirst({ where: { id: migrationId, userId, slug } });
  if (!job) throw new Error('migration not found');
  if (!['schema_ready', 'importing'].includes(job.status)) throw new Error('migration is not accepting files');
  const plan = job.plan as unknown as MigrationPlan;
  const collection = plan.collections.find((item) => item.name === input.collection || item.sourceTable === input.collection);
  if (!collection) throw new Error('collection not found in migration plan');
  const field = collection.fields.find((item) => item.name === input.field);
  if (!field || field.type !== 'file') throw new Error('destination field is not a migration file field');

  const response = await fetchPublicFile(input.sourceUrl);
  if (!response.ok) throw new Error(`source file download failed: ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_BYTES) throw new Error('source file exceeds 25 MB migration limit');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.byteLength > MAX_BYTES) throw new Error('source file must be between 1 byte and 25 MB');
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (input.expectedSha256 && digest !== input.expectedSha256.toLowerCase()) throw new Error('source file checksum mismatch');

  const form = new FormData();
  form.set(input.field, new Blob([bytes], { type: response.headers.get('content-type') || 'application/octet-stream' }), input.filename);
  const result = await instanceMultipartRequest<JsonObject>(userId, slug, 'PATCH', `/api/collections/${collection.name}/records/${destinationId(collection.sourceTable, input.sourceRecordId)}`, form);
  return { ok: true, sha256: digest, bytes: bytes.byteLength, result };
}
