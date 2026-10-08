/** /api/projects — DISABLED. cPanel project API removed. Use /api/vps/requests for VPS instances. */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'cPanel projects are no longer supported. InvisibleDB is now VPS-only.' },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'cPanel projects are no longer supported. InvisibleDB is now VPS-only.' },
    { status: 410 }
  );
}
