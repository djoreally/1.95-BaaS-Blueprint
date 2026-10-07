import { NextResponse } from 'next/server';
import { getPlatformConnection, hostedBaseDomain } from '../../../lib/hosting';

export async function GET() {
  const conn = await getPlatformConnection();
  const baseDomain = conn ? hostedBaseDomain(conn) : '';
  return NextResponse.json({
    ready: Boolean(conn && baseDomain),
    hostingConfigured: Boolean(conn),
    baseDomainConfigured: Boolean(baseDomain),
  });
}
