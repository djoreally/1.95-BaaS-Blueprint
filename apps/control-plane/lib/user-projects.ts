import { prisma } from './db';
import { getJob, startProvisioning, teardownProject, type ProjectJob } from './projects';

export async function listUserJobs(userId: string): Promise<ProjectJob[]> {
  const rows = await prisma.project.findMany({
    where: { userId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  const jobs = await Promise.all(rows.map((r) => getJob(r.id)));
  return jobs.filter((job): job is ProjectJob => Boolean(job));
}

export async function getUserJob(userId: string, id: string): Promise<ProjectJob | undefined> {
  const owned = await prisma.project.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return undefined;
  return getJob(id);
}

export async function startUserProvisioning(
  userId: string,
  name: string,
  domain: string,
  connectionId: string | null,
): Promise<ProjectJob> {
  const job = await startProvisioning(name, domain);
  await prisma.project.update({
    where: { id: job.id },
    data: { userId, connectionId },
  });
  return job;
}

export async function teardownUserProject(userId: string, id: string) {
  const owned = await prisma.project.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) throw new Error('unknown project');
  return teardownProject(id);
}
