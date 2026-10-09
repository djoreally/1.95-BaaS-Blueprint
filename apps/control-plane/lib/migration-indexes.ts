import { prisma } from './db';
import { instanceRequest } from './instance-api';
import { prepareMigration } from './migrations';
import type { MigrationPlan } from './migration-manifest';

export async function prepareMigrationWithIndexes(userId: string, slug: string, migrationId: string) {
  const job = await prepareMigration(userId, slug, migrationId);
  const current = await prisma.migrationJob.findFirst({ where: { id: migrationId, userId, slug } });
  if (!current) throw new Error('migration not found');
  const plan = current.plan as unknown as MigrationPlan;
  try {
    const collections = await instanceRequest<{ items?: Array<{ id: string; name: string }> }>(userId, slug, 'GET', '/api/collections', undefined, { page: '1', perPage: '200' });
    const ids = new Map((collections.items ?? []).map((item) => [item.name, item.id]));
    for (const collection of plan.collections) {
      if (!collection.indexes?.length) continue;
      const id = ids.get(collection.name);
      if (!id) throw new Error(`destination collection missing while applying indexes: ${collection.name}`);
      await instanceRequest(userId, slug, 'PATCH', `/api/collections/${id}`, { indexes: collection.indexes });
    }
    return prisma.migrationJob.update({ where: { id: migrationId }, data: { progress: { ...((current.progress as Record<string, unknown> | null) ?? {}), indexesPreparedAt: new Date().toISOString() } as any } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.migrationJob.update({ where: { id: migrationId }, data: { status: 'failed', error: `index preparation failed: ${message}` } });
    throw error;
  }
}
