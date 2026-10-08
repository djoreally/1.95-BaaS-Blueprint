/** POST /api/connect — preflight and store a BYOH cPanel connection. */
import { NextResponse } from 'next/server';
import { UapiClient } from '@baas-195/adapter-cpanel';
import { currentUser } from '../../../lib/auth';
import { setConnectionForUser } from '../../../lib/connection';
import { checkWildcardDns } from '../../../lib/dns';
import { insecureFetch } from '../../../lib/tls';

export interface PreflightCheck {
  id: string;
  label: string;
  state: 'pass' | 'fail' | 'warn';
  detail: string;
}

export async function POST(req: Request) {
  const authUser = await currentUser();
  if (!authUser) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });

  const { host, user, apiToken } = (await req.json()) as { host?: string; user?: string; apiToken?: string };
  if (!host || !user || !apiToken) {
    return NextResponse.json({ ok: false, error: 'host, user and apiToken are required' }, { status: 400 });
  }
  const cleanHost = host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const checks: PreflightCheck[] = [];

  try {
    const res = await insecureFetch(`https://${cleanHost}:2083/`, { method: 'GET' });
    await res.text().catch(() => '');
    checks.push({ id: 'reach', label: 'Hosting reachable (:2083)', state: 'pass', detail: `HTTPS answered (HTTP ${res.status})` });
  } catch (e) {
    checks.push({ id: 'reach', label: 'Hosting reachable (:2083)', state: 'fail', detail: `No response: ${(e as Error).message}` });
    return NextResponse.json({ ok: false, checks });
  }

  let mainDomain = '';
  let domains: string[] = [];
  let dbCount = 0;
  try {
    const client = new UapiClient({ host: cleanHost, user, apiToken, fetchImpl: insecureFetch as unknown as typeof fetch });
    const d = await client.listDomains();
    mainDomain = d.main;
    domains = [d.main, ...d.subdomains];
    try { dbCount = (await client.listDatabases()).length; } catch { dbCount = -1; }
    checks.push({
      id: 'token', label: 'API token valid', state: 'pass',
      detail: `${domains.length} domain(s) on the account${dbCount >= 0 ? `, ${dbCount} MySQL database(s)` : ''}`,
    });
  } catch (e) {
    checks.push({ id: 'token', label: 'API token valid', state: 'fail', detail: `Token rejected: ${(e as Error).message}` });
    return NextResponse.json({ ok: false, checks });
  }

  const dns = await checkWildcardDns(mainDomain);
  checks.push({ id: 'dns', label: `Wildcard DNS (*.${mainDomain})`, state: dns.ok ? 'pass' : 'warn', detail: dns.detail });
  checks.push({
    id: 'substrate', label: 'Substrate profile', state: 'pass',
    detail: 'Connection verified. Project capacity is enforced by the control plane rather than exposed to other tenants.',
  });

  const ok = checks.every((c) => c.state !== 'fail');
  if (ok) {
    await setConnectionForUser(authUser.id, {
      host: cleanHost, user, apiToken, mainDomain, domains, connectedAt: new Date().toISOString(),
    });
  }
  return NextResponse.json({ ok, checks, mainDomain, domains });
}
