/**
 * Project provisioning orchestration — the atomic unit of the platform.
 *
 * createProject() runs the calls in dependency order and returns everything
 * the supervisor and control plane need:
 *   1. subdomain   (Apache vhost must exist before proxy rules land)
 *   2. database    (app needs credentials at first boot)
 *   3. db user + privileges (one isolated MySQL identity per project)
 *   4. ssl wait    (AutoSSL needs the vhost + DNS; poll, don't assume.
 *                   Side-effect free — a timeout warns, it doesn't roll back.)
 *   5. cron        (watchdog installed so a crash on first boot is caught,
 *                   not silent)
 *
 * Rollback: every mutating step registers its inverse as it succeeds. On
 * failure, inverses run in reverse order and the throw is a ProvisionError
 * carrying per-step rollback results. Anything the rollback couldn't undo
 * needs manual cleanup in cPanel — it is reported, never swallowed.
 *
 * Dry-run: pass dryRun: true. Zero network calls are issued; the returned
 * callLog IS the provisioning plan (every entry stamped with the pinned
 * API version, secrets scrubbed).
 */
import { UapiClient, UapiCallRecord } from './uapi.js';
import { ProvisionError, RollbackFailure } from './errors.js';
import type { UapiConfig } from './uapi.js';

export interface CronSchedule {
  minute?: string;
  hour?: string;
  day?: string;
  month?: string;
  weekday?: string;
}

export interface CreateProjectInput {
  /** URL-safe project slug, e.g. "acme-crm" */
  name: string;
  /** parent domain on the hosting account, e.g. "example.com" */
  domain: string;
  /** TCP port for the project binary — allocate from packages/supervisor/ports.registry */
  port: number;
  /** MySQL password for the project DB user (generate, don't reuse) */
  dbPassword: string;
  /** Defaults to `name` — the left part of the FQDN. */
  subdomain?: string;
  /** Defaults to `${name}_db` (cPanel prefixes the account name). */
  dbName?: string;
  /** Defaults to `${name}_u` (cPanel prefixes the account name). */
  dbUser?: string;
  /** Defaults to `public_html/${name}` (relative to the account home). */
  docRoot?: string;
  /** Watchdog cron schedule (default: every 5 minutes). */
  cronSchedule?: CronSchedule;
  /** AutoSSL wait budget in ms (default 120s). */
  sslTimeoutMs?: number;
  /**
   * When false (default), an AutoSSL timeout sets sslPending: true and
   * provisioning continues — the cert usually lands within minutes and the
   * supervisor retries. When true, the timeout fails the whole run.
   */
  failOnSslTimeout?: boolean;
  /** Plan only: no network calls, callLog is the plan. */
  dryRun?: boolean;
}

export interface ProjectProvisioned {
  name: string;
  fqdn: string;
  port: number;
  db: { name: string; user: string };
  /** document root where the supervisor installs proxy rules + binary */
  docRoot: string;
  /** true when AutoSSL hadn't issued the cert within sslTimeoutMs */
  sslPending: boolean;
  /**
   * true when the per-project watchdog cron could not be installed.
   * Non-fatal: the supervisor runs a single global watchdog (installed once
   * via bin/install.sh or the host's panel), so per-project cron is legacy.
   * On hosts where UAPI Cron is broken (e.g. OrangeHost server306, missing
   * Cpanel::API::Cron), this is expected — the global watchdog covers it.
   */
  cronSkipped: boolean;
  dryRun: boolean;
  /** audit trail (live) or provisioning plan (dry-run), secrets scrubbed */
  callLog: readonly UapiCallRecord[];
}

export interface TeardownReport {
  name: string;
  removed: string[];
  errors: RollbackFailure[];
}

interface UndoStep {
  step: string;
  undo: () => Promise<void>;
}

function validateName(name: string): void {
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
    throw new Error(
      `invalid project name "${name}": use lowercase letters, digits, hyphens (DNS-safe, max 63 chars)`,
    );
  }
}

export async function createProject(cfg: UapiConfig, input: CreateProjectInput): Promise<ProjectProvisioned> {
  validateName(input.name);
  if (!input.domain) throw new Error('CreateProjectInput.domain is required');
  if (!input.dbPassword) throw new Error('CreateProjectInput.dbPassword is required');

  const sub = input.subdomain ?? input.name;
  const fqdn = `${sub}.${input.domain}`;
  const docRoot = input.docRoot ?? `public_html/${input.name}`;
  const dbName = input.dbName ?? `${input.name}_db`;
  const dbUser = input.dbUser ?? `${input.name}_u`;
  const watchdogCmd =
    `$HOME/apps/${input.name}/watchdog.sh >> $HOME/apps/${input.name}/logs/watchdog.log 2>&1`;

  const uapi = new UapiClient({ ...cfg, dryRun: input.dryRun ?? cfg.dryRun ?? false });
  const undone: UndoStep[] = [];
  const abort = async (step: string, cause: unknown): Promise<never> => {
    throw new ProvisionError(step, cause, await rollback(undone));
  };

  // Version pin: refuse before touching anything when a probe is configured.
  try {
    await uapi.verifyServerVersion();
  } catch (e) {
    throw new ProvisionError('version-check', e);
  }

  // 1. subdomain
  try {
    await uapi.addSubdomain(sub, input.domain, docRoot);
    undone.push({ step: 'subdomain', undo: () => uapi.deleteSubdomain(fqdn) });
  } catch (e) {
    return abort('subdomain', e);
  }

  // 2 + 3. database, user, privileges — granular (not the bundled helper)
  // so a mid-sequence failure still rolls back the parts that succeeded.
  let db: string;
  let user: string;
  try {
    db = await uapi.createDatabase(dbName);
    undone.push({ step: 'database', undo: () => uapi.deleteDatabase(db) });
  } catch (e) {
    return abort('database', e);
  }
  try {
    user = await uapi.createDatabaseUser(dbUser, input.dbPassword);
    undone.push({ step: 'db-user', undo: () => uapi.deleteDatabaseUser(user) });
  } catch (e) {
    return abort('db-user', e);
  }
  try {
    await uapi.grantAllPrivileges(user, db);
  } catch (e) {
    return abort('db-privileges', e);
  }

  // 4. SSL — AutoSSL wait is read-only; a timeout warns, it doesn't roll back.
  let sslPending = false;
  try {
    await uapi.waitForAutoSsl(fqdn, input.sslTimeoutMs);
  } catch (e) {
    if (input.failOnSslTimeout) return abort('ssl', e);
    sslPending = true;
  }

  // 5. watchdog cron (legacy per-project line; global watchdog is the real
  //    supervisor — a failure here is non-fatal by design)
  let cronSkipped = false;
  try {
    await uapi.addCronLine(watchdogCmd, input.cronSchedule);
    undone.push({
      step: 'cron',
      undo: () => uapi.removeCronLinesMatching(`apps/${input.name}/watchdog.sh`).then(() => undefined),
    });
  } catch (e) {
    cronSkipped = true;
  }

  return {
    name: input.name,
    fqdn,
    port: input.port,
    db: { name: db, user },
    docRoot,
    sslPending,
    cronSkipped,
    dryRun: input.dryRun ?? cfg.dryRun ?? false,
    callLog: uapi.getCallLog(),
  };
}

/** Run registered undo steps in reverse order, collecting failures. */
async function rollback(steps: UndoStep[]): Promise<RollbackFailure[]> {
  const failures: RollbackFailure[] = [];
  for (const s of [...steps].reverse()) {
    try {
      await s.undo();
    } catch (e) {
      failures.push({ step: s.step, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return failures;
}

/**
 * deleteProject() — teardown in reverse dependency order for clean
 * offboarding. Best-effort: every step is attempted, failures are reported
 * (never thrown), so one stuck resource doesn't block the rest.
 */
export async function deleteProject(
  cfg: UapiConfig,
  input: Pick<CreateProjectInput, 'name' | 'domain' | 'subdomain' | 'dbName' | 'dbUser' | 'dryRun'>,
): Promise<TeardownReport> {
  validateName(input.name);
  const sub = input.subdomain ?? input.name;
  const fqdn = `${sub}.${input.domain}`;
  const uapi = new UapiClient({ ...cfg, dryRun: input.dryRun ?? cfg.dryRun ?? false });
  const report: TeardownReport = { name: input.name, removed: [], errors: [] };

  // Derive the cPanel-prefixed names the same way provisionDatabase does.
  const account = cfg.user;
  const db = `${account}_${input.dbName ?? `${input.name}_db`}`.slice(0, 64);
  const user = `${account}_${input.dbUser ?? `${input.name}_u`}`.slice(0, 32);

  const attempt = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
      report.removed.push(label);
    } catch (e) {
      report.errors.push({ step: label, error: e instanceof Error ? e.message : String(e) });
    }
  };

  await attempt('cron', () => uapi.removeCronLinesMatching(`apps/${input.name}/watchdog.sh`));
  await attempt('db-user', () => uapi.deleteDatabaseUser(user));
  await attempt('database', () => uapi.deleteDatabase(db));
  await attempt('subdomain', () => uapi.deleteSubdomain(fqdn));
  return report;
}
