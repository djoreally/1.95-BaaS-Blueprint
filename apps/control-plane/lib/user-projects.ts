import { prisma } from './db';
import { getConnectionById, type HostingConnection } from './connection';
import {
  getJob,
  startProvisioningFor,
  teardownProjectWithConnection,
  type ProjectJob,
} from './projects';

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
  connection: HostingConnection,
): Promise<ProjectJob> {
  return startProvisioningFor(userId, connection, name, domain);
}

export async function teardownUserProject(userId: string, id: string) {
  const owned = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true, connectionId: true },
  });
  if (!owned) throw new Error('unknown project');
  if (!owned.connectionId) throw new Error('project has no hosting connection');

  const connection = await getConnectionById(owned.connectionId);
  if (!connection) throw new Error('project hosting connection is unavailable');

  return teardownProjectWithConnection(id, connection);
}
