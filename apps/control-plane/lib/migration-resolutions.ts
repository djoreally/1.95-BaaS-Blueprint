import { Prisma } from '@prisma/client';
import { prisma } from './db';
import type { MigrationPlan } from './migration-manifest';

type Resolution = { blocker: string; evidence: string; resolvedAt: string };
type Progress = Record<string, unknown> & { resolutions?: Resolution[] };

export async function resolveMigrationBlocker(userId: string, slug: string, migrationId: string, blocker: string, evidence: string) {
  if (!blocker || !evidence.trim()) throw new Error('blocker and evidence are required');
  const job = await prisma.migrationJob.findFirst({ where: { id: migrationId, userId, slug } });
  if (!job) throw new Error('migration not found');
  const plan = job.plan as unknown as MigrationPlan;
  if (!plan.blockers.includes(blocker)) throw new Error('blocker is not active on this migration');
  const progress = ((job.progress as Progress | null) ?? {}) as Progress;
  const resolutions = [...(progress.resolutions ?? []), { blocker, evidence: evidence.trim().slice(0, 2000), resolvedAt: new Date().toISOString() }];
  const nextPlan: MigrationPlan = { ...plan, blockers: plan.blockers.filter((item) => item !== blocker) };
  const penalty = Math.min(70, nextPlan.blockers.length * 12 + nextPlan.warnings.length * 2);
  nextPlan.compatibility = Math.max(0, 100 - penalty);
  return prisma.migrationJob.update({ where: { id: migrationId }, data: { plan: nextPlan as unknown as Prisma.InputJsonValue, progress: { ...progress, resolutions } as unknown as Prisma.InputJsonValue, status: job.status === 'staged' ? 'importing' : job.status } });
}
