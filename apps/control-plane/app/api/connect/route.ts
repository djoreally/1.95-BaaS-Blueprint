/** POST /api/connect — DISABLED. BYOH cPanel flow removed. */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { ok: false, error: 'BYOH cPanel connections are no longer supported. InvisibleDB is now VPS-only.' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'BYOH cPanel connections are no longer supported. InvisibleDB is now VPS-only.' },
    { status: 410 }
  );
}
