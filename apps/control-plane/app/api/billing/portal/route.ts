import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { createBillingPortal } from '../../../../lib/billing';

export async function GET() {
  const user = await currentUser();
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://baas.innovarel.dev';
  if (!user) return NextResponse.redirect(new URL('/login', base));

  try {
    const session = await createBillingPortal(user.id);
    return NextResponse.redirect(session.url);
  } catch {
    return NextResponse.redirect(new URL('/pricing', base));
  }
}
