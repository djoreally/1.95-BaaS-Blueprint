import { NextResponse } from 'next/server';
import { applyStripeEvent, verifyStripeWebhook } from '../../../../lib/billing';

export async function POST(req: Request) {
  const rawBody = await req.text();
  try {
    const event = verifyStripeWebhook(rawBody, req.headers.get('stripe-signature'));
    await applyStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
