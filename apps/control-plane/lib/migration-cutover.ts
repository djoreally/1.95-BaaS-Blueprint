import { Prisma } from '@prisma/client';
import { prisma } from './db';
import type { MigrationPlan } from './migration-manifest';

type JsonObject = Record<string, unknown>;

export async function cutoverMigrationSafe(userId: string, slug: string, migrationId: string) {
  const job = await prisma.migrationJob.findFirst({ where: { id: migrationId, userId, slug } });
  if (!job) throw new Error('migration not found');
  const verification = job.verification as JsonObject | null;
  if (!verification || verification.state !== 'VERIFIED' || job.status !== 'verified') throw new Error('cutover requires VERIFIED migration evidence');
  const plan = job.plan as unknown as MigrationPlan;
  if (plan.blockers.length) throw new Error('cutover requires zero unresolved compatibility blockers');

  const baseDomain = process.env.IDB_BASE_DOMAIN || 'invisibledb.app';
  const baseUrl = `https://${slug}.${baseDomain}`;
  const authCollection = plan.collections.find((collection) => collection.type === 'auth')?.name ?? null;
  const storageCollection = plan.collections.find((collection) => collection.sourceTable === '__storage_objects__')?.name ?? null;
  const result = {
    baseUrl,
    browser: {
      baseUrl,
      authCollection,
      serverKeyRequired: false,
      supabaseCompatibility: {
        import: `import { createClient } from 'invisibledb/supabase'`,
        create: `createClient('${baseUrl}', undefined, { authCollection: '${authCollection ?? 'users'}' })`,
      },
    },
    server: {
      baseUrl,
      keySource: 'idb_keys',
      warning: 'The idb_live instance server key is privileged. Store it only in server-side secret storage; never expose it in Lovable/browser code.',
    },
    storageCollection,
    instructions: [
      'Point browser data/auth traffic at the public InvisibleDB base URL. The gateway passes normal PocketBase user tokens through collection rules.',
      'Do not place the instance server key in VITE_, NEXT_PUBLIC_, browser bundles, Lovable client code, or any other public environment variable.',
      'Use the Supabase compatibility adapter as a transition layer, then migrate call sites to the native InvisibleDB SDK over time.',
      'Keep the source backend read-only during the rollback window and smoke-test auth, CRUD, realtime, storage, and critical workflows before removing it.',
    ],
  };
  const progress = ((job.progress as JsonObject | null) ?? {});
  const updated = await prisma.migrationJob.update({
    where: { id: migrationId },
    data: { status: 'cutover', completedAt: new Date(), progress: { ...progress, cutover: result } as unknown as Prisma.InputJsonValue },
  });
  return { job: updated, cutover: result };
}
