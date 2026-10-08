/**
 * Legacy cPanel project-detail API — retired.
 * Customer instances now use /projects/[slug] plus the VPS runtime/data APIs.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Legacy cPanel project API is retired. Use the InvisibleDB VPS control plane.' },
    { status: 410 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Legacy cPanel project API is retired. Use the InvisibleDB VPS lifecycle controls.' },
    { status: 410 },
  );
}
