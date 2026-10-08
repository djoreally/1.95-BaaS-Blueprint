import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { createBillingPortal } from '../../../../lib/billing';

export async function GET(req: Request) {
  const user = await currentUser();
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'www.invisibledb.app';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const base = `${proto}://${host}`;
  if (!user) return NextResponse.redirect(new URL('/login', base));

  try {
    const session = await createBillingPortal(user.id);
    return NextResponse.redirect(session.url);
  } catch {
    return NextResponse.redirect(new URL('/pricing', base));
  }
}
