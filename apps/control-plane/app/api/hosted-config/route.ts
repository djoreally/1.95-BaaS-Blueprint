import { NextResponse } from 'next/server';
import { getPlatformConnection, hostedBaseDomain } from '../../../lib/hosting';

export async function GET() {
  const conn = await getPlatformConnection();
  return NextResponse.json({
    mode: 'HOSTED',
    configured: Boolean(conn),
    baseDomain: conn ? hostedBaseDomain(conn) : null,
  });
}
