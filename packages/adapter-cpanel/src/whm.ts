/**
 * WHM API client — reseller tier only (Spark plan and up).
 *
 * Talks to:
 *   https://<host>:2087/json-api/<function>?api.version=1&<params>
 * authenticated with a WHM API token (root/reseller).
 *
 * This is the provisioning primitive the control plane uses once tenants
 * graduate from the single Micro box to isolated cPanel accounts
 * (see docs/15-reseller-tier.md).
 */
export interface WhmConfig {
  host: string;
  /** WHM API token for the reseller account */
  apiToken: string;
}

interface WhmEnvelope<T> {
  metadata: { result: 0 | 1; reason?: string };
  data: T;
}

export interface AccountPackage {
  /** WHM package name, e.g. "baas_tenant" — defines disk/RAM/inode quotas */
  pkg: string;
}

export class WhmClient {
  constructor(private cfg: WhmConfig) {}

  private async call<T>(fn: string, params: Record<string, string> = {}): Promise<T> {
    const qs = new URLSearchParams({ 'api.version': '1', ...params }).toString();
    const url = `https://${this.cfg.host}:2087/json-api/${fn}?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `whm root:${this.cfg.apiToken}` } });
    if (!res.ok) throw new Error(`WHM ${fn}: HTTP ${res.status}`);
    const body = (await res.json()) as WhmEnvelope<T>;
    if (body.metadata.result !== 1) throw new Error(`WHM ${fn}: ${body.metadata.reason ?? 'unknown'}`);
    return body.data;
  }

  /** createacct — provisions one isolated cPanel account per tenant */
  async createAccount(opts: { username: string; domain: string; password: string } & AccountPackage): Promise<void> {
    await this.call('createacct', {
      username: opts.username,
      domain: opts.domain,
      password: opts.password,
      pkg: opts.pkg,
    });
  }

  /** suspendacct / unsuspendacct — the billing enforcement lever */
  async suspendAccount(username: string, reason = 'billing'): Promise<void> {
    await this.call('suspendacct', { user: username, reason });
  }

  async unsuspendAccount(username: string): Promise<void> {
    await this.call('unsuspendacct', { user: username });
  }

  /** removeacct — tenant offboarding (keeps termination explicit, never silent) */
  async removeAccount(username: string): Promise<void> {
    await this.call('removeacct', { user: username, keepdns: '0' });
  }
}
