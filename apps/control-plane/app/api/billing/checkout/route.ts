import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { createHostedCheckout, hasHostedEntitlement } from '../../../../lib/billing';

export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://baas.innovarel.dev';
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', base));

  if (await hasHostedEntitlement(user.id)) {
    return NextResponse.redirect(new URL('/projects/new', base));
  }

  try {
    const session = await createHostedCheckout(user);
    if (!session.url) throw new Error('Stripe Checkout did not return a redirect URL.');
    return NextResponse.redirect(session.url);
  } catch (error) {
    const url = new URL('/pricing', base);
    url.searchParams.set('checkout', 'error');
    url.searchParams.set('reason', (error as Error).message.slice(0, 160));
    return NextResponse.redirect(url);
  }
}
