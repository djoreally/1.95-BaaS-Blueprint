import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { queueMigrationSnapshot } from './migrations';

type Progress = Record<string, unknown>;

export async function queueMigrationSnapshotOnce(userId: string, slug: string, migrationId: string) {
  const job = await prisma.migrationJob.findFirst({ where: { id: migrationId, userId, slug } });
  if (!job) throw new Error('migration not found');
  const progress = ((job.progress as Progress | null) ?? {});
  const snapshotCommandId = typeof progress.snapshotCommandId === 'string' ? progress.snapshotCommandId : null;
  if (!snapshotCommandId) return queueMigrationSnapshot(userId, slug, migrationId);

  const command = await prisma.runtimeCommand.findUnique({ where: { id: snapshotCommandId } });
  if (!command || command.status === 'failed') {
    const cleaned = { ...progress };
    delete cleaned.snapshotCommandId;
    delete cleaned.preMigrationBackup;
    await prisma.migrationJob.update({ where: { id: migrationId }, data: { status: 'planned', progress: cleaned as Prisma.InputJsonValue, error: null } });
    return queueMigrationSnapshot(userId, slug, migrationId);
  }

  return prisma.migrationJob.update({
    where: { id: migrationId },
    data: {
      status: 'snapshotting',
      error: null,
      progress: { ...progress, snapshotCommandId, snapshotReusedAt: new Date().toISOString() } as Prisma.InputJsonValue,
    },
  });
}
