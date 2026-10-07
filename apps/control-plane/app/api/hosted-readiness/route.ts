import { NextResponse } from 'next/server';
import { checkWildcardDns } from '../../../lib/dns';
import { getPlatformConnection, hostedBaseDomain } from '../../../lib/hosting';

export async function GET() {
  const conn = await getPlatformConnection();
  const baseDomain = conn ? hostedBaseDomain(conn) : '';
  const domainBelongsToPlatform = Boolean(
    conn && baseDomain && (baseDomain === conn.mainDomain || conn.domains.includes(baseDomain)),
  );
  const dns = domainBelongsToPlatform
    ? await checkWildcardDns(baseDomain)
    : { ok: false, detail: baseDomain ? 'Configured hosted base domain is not attached to the platform hosting account.' : 'No hosted base domain configured.' };

  return NextResponse.json({
    ready: Boolean(conn && domainBelongsToPlatform && dns.ok),
    hostingConfigured: Boolean(conn),
    baseDomainConfigured: Boolean(baseDomain),
    domainBelongsToPlatform,
    wildcardDnsReady: dns.ok,
    dnsDetail: dns.detail,
  });
}
