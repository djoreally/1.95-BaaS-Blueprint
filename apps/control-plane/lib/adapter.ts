/**
 * Control-plane ↔ adapter bridge.
 *
 * The dashboard never touches raw UAPI/WHM calls — everything goes through
 * @baas-195/adapter-cpanel. Hosting credentials live in env vars
 * (CPANEL_HOST, CPANEL_USER, CPANEL_API_TOKEN), never in the repo.
 */
import { createProject as adapterCreateProject, UapiClient } from '@baas-195/adapter-cpanel';
import type { CreateProjectInput, ProjectProvisioned } from '@baas-195/adapter-cpanel';

function uapiConfig() {
  const host = process.env.CPANEL_HOST;
  const user = process.env.CPANEL_USER;
  const apiToken = process.env.CPANEL_API_TOKEN;
  if (!host || !user || !apiToken) {
    throw new Error('Missing CPANEL_HOST / CPANEL_USER / CPANEL_API_TOKEN');
  }
  return { host, user, apiToken };
}

export interface ProjectSummary {
  name: string;
  fqdn: string;
  port: number;
  status: 'unknown';
}

/** TODO: back this with a real project store (SQLite via the adapter DB). */
const memoryStore: ProjectSummary[] = [];

export async function listProjects(): Promise<ProjectSummary[]> {
  return memoryStore;
}

/** Wizard submit handler: validates, allocates a port, provisions. */
export async function provisionProject(input: CreateProjectInput): Promise<ProjectProvisioned> {
  const provisioned = await adapterCreateProject(uapiConfig(), input);
  memoryStore.push({
    name: provisioned.name,
    fqdn: provisioned.fqdn,
    port: provisioned.port,
    status: 'unknown',
  });
  return provisioned;
}

export { UapiClient };
