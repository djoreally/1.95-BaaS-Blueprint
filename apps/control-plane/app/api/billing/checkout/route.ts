import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/auth';
import { createHostedCheckout } from '../../../../lib/billing';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'https://baas.innovarel.dev'));

  try {
    const session = await createHostedCheckout(user);
    if (!session.url) throw new Error('Stripe Checkout did not return a redirect URL.');
    return NextResponse.redirect(session.url);
  } catch (error) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://baas.innovarel.dev';
    const url = new URL('/pricing', base);
    url.searchParams.set('checkout', 'error');
    url.searchParams.set('reason', (error as Error).message.slice(0, 160));
    return NextResponse.redirect(url);
  }
}
