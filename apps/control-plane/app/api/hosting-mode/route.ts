import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizeHostingMode } from '../../../lib/hosting';

export async function GET() {
  const jar = await cookies();
  const hostingMode = normalizeHostingMode(jar.get('baas_hosting_mode')?.value);
  return NextResponse.json({ hostingMode });
}
