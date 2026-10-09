import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { instanceRequest } from './instance-api';
import { verifyMigration } from './migrations';
import type { MigrationManifest, MigrationPlan } from './migration-manifest';

type Verification = Record<string, unknown> & {
  state?: string;
  missingExactStorageCounts?: string[];
  storageFileChecks?: Array<{ collection: string; expected: number | null; attachedFiles: number; exact: boolean }>;
};

export async function verifyMigrationStrict(userId: string, slug: string, migrationId: string) {
  const job = await verifyMigration(userId, slug, migrationId);
  const manifest = job.manifest as unknown as MigrationManifest;
  const plan = job.plan as unknown as MigrationPlan;
  const missingStorageCounts = (manifest.storage?.buckets ?? []).filter((bucket) => bucket.objectsCount == null).map((bucket) => bucket.name);
  const storageCollections = plan.collections.filter((collection) => collection.sourceTable === '__storage_objects__');
  const storageFileChecks: Array<{ collection: string; expected: number | null; attachedFiles: number; exact: boolean }> = [];

  for (const collection of storageCollections) {
    const result = await instanceRequest<{ totalItems?: number }>(userId, slug, 'GET', `/api/collections/${collection.name}/records`, undefined, { page: '1', perPage: '1', filter: 'file != ""' });
    const attachedFiles = Number(result.totalItems ?? 0);
    storageFileChecks.push({ collection: collection.name, expected: collection.expectedRows, attachedFiles, exact: collection.expectedRows !== null && collection.expectedRows === attachedFiles });
  }

  const storageComplete = missingStorageCounts.length === 0 && storageFileChecks.every((check) => check.exact);
  if (storageComplete) return job;

  const verification = ((job.verification as Verification | null) ?? {}) as Verification;
  const next: Verification = {
    ...verification,
    state: verification.state === 'FAILED' ? 'FAILED' : 'PARTIAL',
    missingExactStorageCounts: missingStorageCounts,
    storageFileChecks,
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
