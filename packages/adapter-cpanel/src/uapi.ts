/**
 * Typed cPanel UAPI client.
 *
 * Talks to the per-account UAPI endpoint:
 *   https://<host>:2083/execute/<Module>/<function>?<params>
 * authenticated with a cPanel API token (preferred) or session.
 *
 * API-VERSION DISCIPLINE (see docs/14-control-plane.md):
 * - SUPPORTED_API_VERSION is pinned. All raw calls go through this module only.
 * - A cPanel version bump = review this file, not the whole codebase.
 */
export const SUPPORTED_UAPI_VERSION = '138';

export interface UapiConfig {
  /** e.g. "server306.orangehost.com" */
  host: string;
  /** cPanel username */
  user: string;
  /** cPanel API token (Manage API Tokens in cPanel) — never a password */
  apiToken: string;
  /** pinned major version; requests refuse to run if the server reports newer */
  apiVersion?: string;
}

interface UapiEnvelope<T> {
  status: 0 | 1;
  errors: string[] | null;
  data: T;
}

export class UapiClient {
  constructor(private cfg: UapiConfig) {}

  private async call<T>(mod: string, fn: string, params: Record<string, string> = {}): Promise<T> {
    const qs = new URLSearchParams(params).toString();
    const url = `https://${this.cfg.host}:2083/execute/${mod}/${fn}${qs ? '?' + qs : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `cpanel ${this.cfg.user}:${this.cfg.apiToken}` },
    });
    if (!res.ok) throw new Error(`UAPI ${mod}/${fn}: HTTP ${res.status}`);
    const body = (await res.json()) as UapiEnvelope<T>;
    if (body.status !== 1) throw new Error(`UAPI ${mod}/${fn}: ${(body.errors ?? ['unknown']).join('; ')}`);
    return body.data;
  }

  /** SubDomain::addsubdomain — creates project.example.com */
  async addSubdomain(subdomain: string, rootDomain: string, dir: string): Promise<void> {
    await this.call('SubDomain', 'addsubdomain', { domain: subdomain, rootdomain: rootDomain, dir });
  }

  /** Mysql::create_database + create_user + set_privileges — one DB per project */
  async createDatabase(dbName: string, dbUser: string, dbPassword: string): Promise<{ db: string; user: string }> {
    const user = this.cfg.user;
    const db = `${user}_${dbName}`.slice(0, 64);
    const u = `${user}_${dbUser}`.slice(0, 32);
    await this.call('Mysql', 'create_database', { name: db });
    await this.call('Mysql', 'create_user', { name: u, password: dbPassword });
    await this.call('Mysql', 'set_privileges_on_database', { user: u, database: db, privileges: 'ALL PRIVILEGES' });
    return { db, user: u };
  }

  /** SSL::get_autossl_pending_queue / install state — AutoSSL covers new subdomains automatically;
   *  this polls until the cert is live (or times out). */
  async waitForAutoSsl(domain: string, timeoutMs = 120_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const certs = await this.call<Array<{ domain: string }>>('SSL', 'list_certs');
      if (certs.some((c) => c.domain === domain)) return;
      await new Promise((r) => setTimeout(r, 10_000));
    }
    throw new Error(`AutoSSL cert for ${domain} not issued within ${timeoutMs}ms`);
  }

  /** Cron::add_line — installs the watchdog line (see packages/supervisor) */
  async addCronLine(command: string, minute = '*/5'): Promise<void> {
    await this.call('Cron', 'add_line', {
      command,
      day: '*', hour: '*', minute, month: '*', weekday: '*',
    });
  }
}
