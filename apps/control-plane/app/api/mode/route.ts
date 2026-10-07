import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ modes: ['HOSTED', 'BYOH'], defaultMode: 'HOSTED' });
}
