import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export async function GET() {
  const instances = await prisma.provisionRequest.count({ where: { kind: 'provision', status: 'done' } });
  return NextResponse.json({ ok: true, version: '0.2.0', instances });
}
