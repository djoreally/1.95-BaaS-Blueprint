/**
 * Typed cPanel UAPI client.
 *
 * Talks to the per-account UAPI endpoint:
 *   POST https://<host>:2083/execute/<Module>/<function>
 * authenticated with a cPanel API token (never a password).
 *
 * API-VERSION DISCIPLINE (see docs/14-control-plane.md):
 * - SUPPORTED_UAPI_VERSION is pinned. Every raw call funnels through the
 *   private callUapi(), which stamps the pinned version on the request
 *   (header) and on the internal call ledger (audit / dry-run plans).
 * - assertCompatibleVersion() refuses to run against a newer server major.
 *   UAPI itself exposes no version endpoint, so the check runs against an
 *   injected probe; on the reseller tier the sanctioned probe is
 *   WhmClient.getVersion() (WHM API 1 `version`). UAPI-only accounts run
 *   with the pin assumed — the ledger records the assumption.
 * - A cPanel version bump = review this file, not the whole codebase.
 */
import { UapiError, VersionMismatchError } from './errors.js';

/** cPanel major version this adapter was built and tested against. */
export const SUPPORTED_UAPI_VERSION = '138';

export interface UapiConfig {
  /** e.g. "server306.orangehost.com" — no scheme, no port */
  host: string;
  /** cPanel username */
  user: string;
  /** cPanel API token (Security → Manage API Tokens). Never a password. */
  apiToken: string;
  /** Override the pinned version (default: SUPPORTED_UAPI_VERSION). */
  apiVersion?: string;
  /**
   * When true, no HTTP is issued. Every call is recorded on the ledger and
   * returns an empty payload. The ledger IS the provisioning plan.
   */
  dryRun?: boolean;
  /** Injectable fetch (tests, or runtimes without global fetch). */
  fetchImpl?: typeof fetch;
  /**
   * Optional async probe returning the server's cPanel version string, e.g.
   * "11.138.0.11". When present, createProject() verifies it before step 1.
   * UAPI exposes no version endpoint, so there is no default probe — on the
   * reseller tier, pass `() => whm.getVersion()`.
   */
  versionProbe?: () => Promise<string>;
}

export interface UapiCallRecord {
  apiVersion: string;
  module: string;
  func: string;
  params: Record<string, string>;
  dryRun: boolean;
}

/** One crontab entry, normalized from Cron::list_lines. */
export interface CronLine {
  line: number;
  command: string;
}

interface UapiEnvelope<T> {
  status: 0 | 1;
  errors: string[] | null;
  data: T;
}

/**
 * Compare a server version string ("11.138.0.11") against the pinned major.
 * Throws VersionMismatchError when the server is NEWER than the pin.
 * Older servers are allowed — the pin is a ceiling, not a floor.
 */
export function assertCompatibleVersion(serverVersion: string, pinned: string = SUPPORTED_UAPI_VERSION): void {
  const m = serverVersion.match(/(\d+)\.(\d+)/);
  if (!m) throw new VersionMismatchError(pinned, serverVersion);
  const serverMajor = parseInt(m[2], 10);
  const pinnedMajor = parseInt(pinned, 10);
  if (Number.isNaN(serverMajor) || Number.isNaN(pinnedMajor)) {
    throw new VersionMismatchError(pinned, serverVersion);
  }
  if (serverMajor > pinnedMajor) throw new VersionMismatchError(pinned, serverVersion);
}

export class UapiClient {
  readonly apiVersion: string;
  private readonly dryRun: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly ledger: UapiCallRecord[] = [];
  private versionChecked = false;

  constructor(private cfg: UapiConfig) {
    if (!cfg.host) throw new Error('UapiConfig.host is required');
    if (!cfg.user) throw new Error('UapiConfig.user is required');
    if (!cfg.apiToken) throw new Error('UapiConfig.apiToken is required');
    this.apiVersion = cfg.apiVersion ?? SUPPORTED_UAPI_VERSION;
    this.dryRun = cfg.dryRun ?? false;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  /** Read-only audit trail of every call (real or dry-run) this client made. */
  getCallLog(): readonly UapiCallRecord[] {
    return this.ledger;
  }

  /**
   * THE funnel. Every raw UAPI call in the platform goes through here —
   * nothing above this class touches fetch() for cPanel.
   */
  private async callUapi<T>(module: string, func: string, params: Record<string, string> = {}): Promise<T> {
    const record: UapiCallRecord = {
      apiVersion: this.apiVersion,
      module,
      func,
      params: { ...params },
      dryRun: this.dryRun,
    };
    // Scrub secrets from the ledger copy (the live request still carries them).
    for (const k of Object.keys(record.params)) {
      if (/pass|token|secret/i.test(k)) record.params[k] = '***';
    }
    this.ledger.push(record);

    if (this.dryRun) return {} as T;

    const url = `https://${this.cfg.host}:2083/execute/${module}/${func}`;
    // POST with a form body: keeps passwords out of URLs (and server logs).
    // Retry transport-level failures (killed connections, timeouts) with
    // backoff — shared hosting and egress proxies throttle bursty API use.
    // API-level errors (HTTP 4xx/5xx, status 0) are deterministic: no retry.
    const delaysMs = [5000, 15000, 30000];
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `cpanel ${this.cfg.user}:${this.cfg.apiToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Baas-Cpanel-Api-Version': this.apiVersion,
          },
          body: new URLSearchParams(params).toString(),
        });
        if (!res.ok) throw new UapiError(module, func, `HTTP ${res.status}`, res.status);
        const body = (await res.json()) as UapiEnvelope<T>;
        if (body.status !== 1) {
          throw new UapiError(module, func, (body.errors ?? ['unknown error']).join('; '));
        }
        return body.data;
      } catch (e) {
        if (e instanceof UapiError) throw e; // deterministic — don't retry
        lastErr = e;
        if (attempt < delaysMs.length) await new Promise((r) => setTimeout(r, delaysMs[attempt]));
      }
    }
    throw new UapiError(module, func, `transport failed after retries: ${(lastErr as Error)?.message ?? lastErr}`);
  }

  /** Run the version probe (if configured) and refuse on drift. Idempotent. */
  async verifyServerVersion(): Promise<void> {
    if (this.versionChecked || !this.cfg.versionProbe) return;
    const reported = await this.cfg.versionProbe();
    assertCompatibleVersion(reported, this.apiVersion);
    this.versionChecked = true;
  }

  // ---------------------------------------------------------------- SubDomain

  /** SubDomain::addsubdomain — creates sub.example.com rooted at `dir`. */
  async addSubdomain(subdomain: string, rootDomain: string, dir: string): Promise<void> {
    await this.callUapi('SubDomain', 'addsubdomain', {
      domain: subdomain,
      rootdomain: rootDomain,
      dir,
    });
  }

  /** SubDomain::delsubdomain — removes the vhost (rollback / offboarding). */
  async deleteSubdomain(fqdn: string): Promise<void> {
    await this.callUapi('SubDomain', 'delsubdomain', { domain: fqdn });
  }

  // --------------------------------------------------------------------- Mysql

  /** Mysql::create_database. Name is prefixed with the cPanel user. */
  async createDatabase(name: string): Promise<string> {
    const db = `${this.cfg.user}_${name}`.slice(0, 64);
    await this.callUapi('Mysql', 'create_database', { name: db });
    return db;
  }

  /** Mysql::delete_database (rollback / offboarding). */
  async deleteDatabase(prefixedName: string): Promise<void> {
    await this.callUapi('Mysql', 'delete_database', { name: prefixedName });
  }

  /** Mysql::create_user. Name is prefixed with the cPanel user. */
  async createDatabaseUser(name: string, password: string): Promise<string> {
    const user = `${this.cfg.user}_${name}`.slice(0, 32);
    await this.callUapi('Mysql', 'create_user', { name: user, password });
    return user;
  }

  /** Mysql::delete_user (rollback / offboarding). */
  async deleteDatabaseUser(prefixedName: string): Promise<void> {
    await this.callUapi('Mysql', 'delete_user', { name: prefixedName });
  }

  /** Mysql::set_privileges_on_database — ALL PRIVILEGES for the project user. */
  async grantAllPrivileges(prefixedUser: string, prefixedDb: string): Promise<void> {
    await this.callUapi('Mysql', 'set_privileges_on_database', {
      user: prefixedUser,
      database: prefixedDb,
      privileges: 'ALL PRIVILEGES',
    });
  }

  /**
   * Convenience: create_database + create_user + set_privileges_on_database —
   * one isolated MySQL identity per project.
   */
  async provisionDatabase(
    dbName: string,
    dbUser: string,
    dbPassword: string,
  ): Promise<{ db: string; user: string }> {
    const db = await this.createDatabase(dbName);
    const user = await this.createDatabaseUser(dbUser, dbPassword);
    await this.grantAllPrivileges(user, db);
    return { db, user };
  }

  // ----------------------------------------------------------------------- SSL

  /** SSL::install_ssl — installs a specific cert (custom domains, manual flow). */
  async installSsl(opts: { domain: string; cert: string; key: string; cabundle?: string }): Promise<void> {
    const params: Record<string, string> = { domain: opts.domain, cert: opts.cert, key: opts.key };
    if (opts.cabundle) params.cabundle = opts.cabundle;
    await this.callUapi('SSL', 'install_ssl', params);
  }

  /** SSL::list_certs — domains currently covered by installed certs. */
  async listSslDomains(): Promise<string[]> {
    const certs = await this.callUapi<Array<{ domain?: string; domains?: string[] }>>('SSL', 'list_certs');
    const out = new Set<string>();
    for (const c of certs ?? []) {
      if (c.domain) out.add(c.domain);
      for (const d of c.domains ?? []) out.add(d);
    }
    return [...out];
  }

  /**
   * AutoSSL covers new subdomains automatically; this polls until the cert
   * is live. Side-effect free — safe to retry, nothing to roll back.
   */
  async waitForAutoSsl(domain: string, timeoutMs = 120_000, pollMs = 10_000): Promise<void> {
    if (this.dryRun) {
      // Still record the intent on the ledger, but don't sleep or poll.
      this.ledger.push({
        apiVersion: this.apiVersion,
        module: 'SSL',
        func: 'waitForAutoSsl(poll list_certs)',
        params: { domain },
        dryRun: true,
      });
      return;
    }
    const start = Date.now();
    for (;;) {
      const domains = await this.listSslDomains();
      if (domains.includes(domain)) return;
      if (Date.now() - start >= timeoutMs) {
        throw new UapiError('SSL', 'waitForAutoSsl', `cert for ${domain} not issued within ${timeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  // ---------------------------------------------------------------------- Cron

  /** Cron::add_line — installs a watchdog line (default: every 5 minutes). */
  async addCronLine(
    command: string,
    schedule: { minute?: string; hour?: string; day?: string; month?: string; weekday?: string } = {},
  ): Promise<void> {
    await this.callUapi('Cron', 'add_line', {
      command,
      minute: schedule.minute ?? '*/5',
      hour: schedule.hour ?? '*',
      day: schedule.day ?? '*',
      month: schedule.month ?? '*',
      weekday: schedule.weekday ?? '*',
    });
  }

  /** Cron::list_lines — normalized to line numbers + commands. */
  async listCronLines(): Promise<CronLine[]> {
    const rows = await this.callUapi<Array<Record<string, unknown>>>('Cron', 'list_lines');
    const out: CronLine[] = [];
    for (const r of rows ?? []) {
      const line = typeof r['line'] === 'number' ? r['line'] : parseInt(String(r['line'] ?? ''), 10);
      const command = typeof r['command'] === 'string' ? r['command'] : '';
      if (!Number.isNaN(line) && command) out.push({ line, command });
    }
    return out;
  }

  /** Cron::delete_line — removes one crontab entry by its line number. */
  async deleteCronLine(line: number): Promise<void> {
    await this.callUapi('Cron', 'delete_line', { line: String(line) });
  }

  /**
   * Remove every cron line whose command contains `match` (rollback /
   * offboarding helper — delete_line itself needs a line number).
   * Returns the number of lines removed.
   */
  async removeCronLinesMatching(match: string): Promise<number> {
    const lines = await this.listCronLines();
    let removed = 0;
    for (const l of lines) {
      if (l.command.includes(match)) {
        await this.deleteCronLine(l.line);
        removed++;
      }
    }
    return removed;
  }

  // ----------------------------------------------------------------------- Ftp

  /**
   * Ftp::add_ftp — a jailed deploy user per project (homedir = project dir).
   * Quota 0 = unlimited within the account's own quota.
   */
  async addFtpUser(opts: { user: string; password: string; homedir: string; quota?: number }): Promise<void> {
    await this.callUapi('Ftp', 'add_ftp', {
      user: opts.user,
      pass: opts.password,
      homedir: opts.homedir,
      quota: String(opts.quota ?? 0),
    });
  }

  /** Ftp::delete_ftp — destroy=false keeps the homedir files (safer default). */
  async deleteFtpUser(user: string, destroyHomeDir = false): Promise<void> {
    await this.callUapi('Ftp', 'delete_ftp', {
      user,
      destroy: destroyHomeDir ? '1' : '0',
    });
  }

  // ------------------------------------------------------------------- Fileman

  /**
   * Fileman::get_file_content — read a small text file (logs, configs).
   * `dir` is relative to the account home, e.g. "public_html/acme".
   */
  async readFile(dir: string, file: string): Promise<string> {
    const data = await this.callUapi<{ content?: string }>('Fileman', 'get_file_content', { dir, file });
    return data?.content ?? '';
  }

  /**
   * Fileman::save_file_content — write a small text file.
   * NOTE: this passes through cPanel's AdminBin IPC, which has a small
   * buffer — fine for scripts/configs, but use FTP or upload_files for
   * anything over ~100KB.
   */
  async writeFile(dir: string, file: string, content: string): Promise<void> {
    await this.callUapi('Fileman', 'save_file_content', { dir, file, content });
  }
}
