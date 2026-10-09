import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { verifyMigration } from './migrations';
import type { MigrationManifest } from './migration-manifest';

type Verification = Record<string, unknown> & { state?: string; missingExactStorageCounts?: string[] };

export async function verifyMigrationStrict(userId: string, slug: string, migrationId: string) {
  const job = await verifyMigration(userId, slug, migrationId);
  const manifest = job.manifest as unknown as MigrationManifest;
  const missingStorageCounts = (manifest.storage?.buckets ?? []).filter((bucket) => bucket.objectsCount == null).map((bucket) => bucket.name);
  if (!missingStorageCounts.length) return job;

  const verification = ((job.verification as Verification | null) ?? {}) as Verification;
  const next: Verification = {
    ...verification,
    state: verification.state === 'FAILED' ? 'FAILED' : 'PARTIAL',
    missingExactStorageCounts: missingStorageCounts,
  };
  return prisma.migrationJob.update({
    where: { id: migrationId },
    data: {
      status: next.state === 'FAILED' ? 'failed' : 'staged',
      verification: next as unknown as Prisma.InputJsonValue,
      error: next.state === 'FAILED' ? 'migration verification failed' : null,
    },
  });
}
