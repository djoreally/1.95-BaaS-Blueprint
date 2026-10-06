/**
 * Project provisioning orchestration — the atomic unit of the platform.
 *
 * createProject() runs the calls in dependency order and returns everything
 * the supervisor and control plane need. Every step is idempotent-safe to
 * re-run EXCEPT the binary deploy (handled by the supervisor, not here).
 *
 * Order matters:
 *   1. subdomain  (Apache vhost must exist before proxy rules land)
 *   2. database   (app needs credentials at first boot)
 *   3. cron       (watchdog installed before the binary starts, so a crash
 *                  on first boot is caught, not silent)
 *   4. ssl wait  (AutoSSL needs the vhost + DNS; poll, don't assume)
 */
import { UapiClient, UapiConfig } from './uapi.js';
import { WhmClient } from './whm.js';

export interface CreateProjectInput {
  /** URL-safe project slug, e.g. "acme-crm" */
  name: string;
  /** parent domain on the hosting account, e.g. "example.com" */
  domain: string;
  /** TCP port for the project binary — allocate from packages/supervisor/ports.registry */
  port: number;
  /** MySQL password for the project DB user (generate, don't reuse) */
  dbPassword: string;
}

export interface ProjectProvisioned {
  name: string;
  fqdn: string;
  port: number;
  db: { name: string; user: string };
  /** document root where the supervisor installs proxy rules + binary */
  docRoot: string;
}

export async function createProject(
  cfg: UapiConfig,
  input: CreateProjectInput,
): Promise<ProjectProvisioned> {
  const uapi = new UapiClient(cfg);
  const fqdn = `${input.name}.${input.domain}`;
  const docRoot = `public_html/${input.name}`;

  // 1. subdomain
  await uapi.addSubdomain(input.name, input.domain, docRoot);

  // 2. database (cPanel prefixes db/user with the account name)
  const db = await uapi.createDatabase(`${input.name}_db`, `${input.name}_u`, input.dbPassword);

  // 3. watchdog cron — the supervisor's scripts must already be deployed
  //    to ~/apps/<name>/ (see packages/supervisor/README.md)
  await uapi.addCronLine(`$HOME/apps/${input.name}/watchdog.sh >> $HOME/apps/${input.name}/logs/watchdog.log 2>&1`);

  // 4. SSL — AutoSSL picks up the new vhost; wait for the cert
  await uapi.waitForAutoSsl(fqdn);

  return { name: input.name, fqdn, port: input.port, db, docRoot };
}

export { UapiClient, SUPPORTED_UAPI_VERSION };
export type { UapiConfig };
export { WhmClient };
export type { WhmConfig } from './whm.js';
