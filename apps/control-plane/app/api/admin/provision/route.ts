/** POST /api/admin/provision — direct VPS provision for admin (bypasses Stripe). */
import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';
import { queueRequest } from '../../../../lib/billing';

// TODO: Replace with proper admin role check.
const ADMIN_EMAILS = ['djoreally@gmail.com', 'momsoilchange@gmail.com'];

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: 'admin only' }, { status: 403 });
  }

  const { slug } = (await req.json()) as { slug?: string };
  if (!slug || !/^[a-z0-9-]{3,32}$/.test(slug)) {
    return NextResponse.json({ error: 'valid slug required (3-32 chars, lowercase, numbers, hyphens)' }, { status: 400 });
  }

  // Queue provision directly — no Stripe needed for admin.
  await queueRequest('provision', user.id, user.email, slug);

  return NextResponse.json({ ok: true, slug, message: `Provisioning ${slug}.invisibledb.app — check /projects in ~2 min` });
}
