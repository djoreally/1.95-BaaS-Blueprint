/**
 * POST /api/connect — run the hosting preflight and store the connection.
 *
 * Body: { host, user, apiToken } — cPanel API token, NEVER a password.
 * Checks (all server-side):
 *   1. :2083 reachable
 *   2. token valid (read-only DomainInfo/list_domains via the real adapter)
 *   3. wildcard DNS (*.domain resolves — zero per-project DNS friction)
 *   4. substrate facts (live counts + measured reference)
 * Stores the connection in-memory on success (prod: encrypted vault).
 */
import { NextResponse } from 'next/server';
import { UapiClient } from '@baas-195/adapter-cpanel';
import { setConnection } from '../../../lib/connection';
import { checkWildcardDns } from '../../../lib/dns';
import { insecureFetch } from '../../../lib/tls';

export interface PreflightCheck {
  id: string;
  label: string;
  state: 'pass' | 'fail' | 'warn';
  detail: string;
}

export async function POST(req: Request) {
  const { host, user, apiToken } = (await req.json()) as {
    host?: string;
    user?: string;
    apiToken?: string;
  };
  if (!host || !user || !apiToken) {
    return NextResponse.json({ ok: false, error: 'host, user and apiToken are required' }, { status: 400 });
  }
  const cleanHost = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const checks: PreflightCheck[] = [];

  // 1. :2083 reachable
  try {
    const res = await insecureFetch(`https://${cleanHost}:2083/`, { method: 'GET' });
    await res.text().catch(() => '');
    checks.push({ id: 'reach', label: 'Hosting reachable (:2083)', state: 'pass', detail: `HTTPS answered (HTTP ${res.status})` });
  } catch (e) {
    checks.push({ id: 'reach', label: 'Hosting reachable (:2083)', state: 'fail', detail: `No response: ${(e as Error).message}` });
    return NextResponse.json({ ok: false, checks });
  }

  // 2. token valid — read-only call through the real adapter
  let mainDomain = '';
  let domains: string[] = [];
  let dbCount = 0;
  try {
    const client = new UapiClient({ host: cleanHost, user, apiToken, fetchImpl: insecureFetch as unknown as typeof fetch });
    const d = await client.listDomains();
    mainDomain = d.main;
    domains = [d.main, ...d.subdomains];
    try {
      dbCount = (await client.listDatabases()).length;
    } catch {
      dbCount = -1;
    }
    checks.push({
      id: 'token', label: 'API token valid', state: 'pass',
      detail: `${domains.length} domain(s) on the account${dbCount >= 0 ? `, ${dbCount} MySQL database(s)` : ''}`,
    });
  } catch (e) {
    checks.push({ id: 'token', label: 'API token valid', state: 'fail', detail: `Token rejected: ${(e as Error).message}` });
    return NextResponse.json({ ok: false, checks });
  }

  // 3. wildcard DNS
  const dns = await checkWildcardDns(mainDomain);
  checks.push({
    id: 'dns', label: 'Wildcard DNS (*.' + mainDomain + ')',
    state: dns.ok ? 'pass' : 'warn', detail: dns.detail,
  });

  // 4. substrate facts
  checks.push({
    id: 'substrate', label: 'Substrate profile', state: 'pass',
    detail: 'Measured reference (OrangeHost Micro): PocketBase v0.36.5 idles ~27 MB RSS · MySQL 8.0 · PHP 8.1 · Node 16 · ~10–15 projects fit 1 GB. New vhosts on this host need a support ticket (known).',
  });

  const ok = checks.every((c) => c.state !== 'fail');
  if (ok) {
    setConnection({
      host: cleanHost, user, apiToken, mainDomain, domains,
      connectedAt: new Date().toISOString(),
    });
  }
  return NextResponse.json({ ok, checks, mainDomain, domains });
}
