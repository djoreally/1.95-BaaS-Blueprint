/**
 * WHM API client — reseller tier only (Spark plan and up).
 *
 * Talks to:
 *   https://<host>:2087/json-api/<function>?api.version=1&<params>
 * authenticated with a WHM API token:
 *   Authorization: whm <whm-user>:<token>
 *
 * This is the provisioning primitive the control plane uses once tenants
 * graduate from the single Micro box to isolated cPanel accounts
 * (see docs/15-reseller-tier.md).
 */
import { WhmError } from './errors.js';

export interface WhmConfig {
  /** e.g. "server306.orangehost.com" — no scheme, no port */
  host: string;
  /** WHM username the token belongs to (often "root", or the reseller name). */
  user?: string;
  /** WHM API token (WHM → Manage API Tokens). Never a password. */
  apiToken: string;
  /** Injectable fetch (tests, or runtimes without global fetch). */
  fetchImpl?: typeof fetch;
}

interface WhmEnvelope<T> {
  metadata: { result: 0 | 1; reason?: string };
  data: T;
}

export interface WhmAccountSummary {
  user: string;
  domain: string;
  plan?: string;
  suspended?: boolean;
  [key: string]: unknown;
}

export interface AccountPackage {
  /** WHM package name, e.g. "baas_tenant" — defines disk/RAM/inode quotas */
  pkg: string;
}

export class WhmClient {
  private readonly user: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private cfg: WhmConfig) {
    if (!cfg.host) throw new Error('WhmConfig.host is required');
    if (!cfg.apiToken) throw new Error('WhmConfig.apiToken is required');
    this.user = cfg.user ?? 'root';
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  /**
   * THE funnel. Every raw WHM call in the platform goes through here.
   * api.version=1 is stamped on every request.
   */
  private async callWhm<T>(fn: string, params: Record<string, string> = {}): Promise<T> {
    const qs = new URLSearchParams({ 'api.version': '1', ...params }).toString();
    const url = `https://${this.cfg.host}:2087/json-api/${fn}?${qs}`;
    const res = await this.fetchImpl(url, {
      headers: { Authorization: `whm ${this.user}:${this.cfg.apiToken}` },
    });
    if (!res.ok) throw new WhmError(fn, `HTTP ${res.status}`, res.status);
    const body = (await res.json()) as WhmEnvelope<T>;
    if (body.metadata?.result !== 1) {
      throw new WhmError(fn, body.metadata?.reason ?? 'unknown error');
    }
    return body.data;
  }

  /**
   * WHM `version` — returns e.g. "11.138.0.11".
   * This is the sanctioned version probe for the UAPI pin:
   * pass `() => whm.getVersion()` as UapiConfig.versionProbe.
   */
  async getVersion(): Promise<string> {
    const data = await this.callWhm<{ version?: string }>('version');
    const v = data?.version;
    if (!v) throw new WhmError('version', 'server did not report a version');
    return v;
  }

  /** createacct — provisions one isolated cPanel account per tenant. */
  async createAccount(opts: { username: string; domain: string; password: string } & AccountPackage): Promise<void> {
    await this.callWhm('createacct', {
      username: opts.username,
      domain: opts.domain,
      password: opts.password,
      pkg: opts.pkg,
    });
  }

  /** suspendacct / unsuspendacct — the billing enforcement lever. */
  async suspendAccount(username: string, reason = 'billing'): Promise<void> {
    await this.callWhm('suspendacct', { user: username, reason });
  }

  async unsuspendAccount(username: string): Promise<void> {
    await this.callWhm('unsuspendacct', { user: username });
  }

  /** listaccts — every account under this reseller (for metering / drift checks). */
  async listAccounts(): Promise<WhmAccountSummary[]> {
    const data = await this.callWhm<{ acct?: WhmAccountSummary[] }>('listaccts');
    return data?.acct ?? [];
  }

  /**
   * removeacct — tenant offboarding. Explicit and never silent: the caller
   * decides whether DNS zones survive (default: removed with the account).
   */
  async removeAccount(username: string, keepDns = false): Promise<void> {
    await this.callWhm('removeacct', { user: username, keepdns: keepDns ? '1' : '0' });
  }
}
