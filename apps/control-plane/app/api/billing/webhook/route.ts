/**
 * POST /api/billing/webhook — Stripe webhook.
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
 * Configure in Stripe dashboard: checkout.session.completed,
 * customer.subscription.deleted, invoice.payment_failed.
 *
 * Never trust the client: signature verified with the raw body before parsing.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { upsertSubscription, queueProvision, queueDeprovision, markPastDue, slugForEmail } from '../../../../lib/billing';

export const runtime = 'nodejs';

function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key);
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text(); // raw body REQUIRED for verification
    event = stripe().webhooks.constructEvent(rawBody, sig, whSecret);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const email = s.customer_details?.email || s.customer_email;
        if (!email || !s.customer) break;
        await upsertSubscription({
          email: email.toLowerCase(),
          stripeCustomerId: s.customer as string,
          stripeSubId: s.subscription as string | undefined,
        });
        // The VPS poller picks this up within ~2 min and provisions.
        await queueProvision(email.toLowerCase(), slugForEmail(email));
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe().customers.retrieve(sub.customer as string);
        const email = !('deleted' in customer) ? customer.email : null;
        if (email) await queueDeprovision(email.toLowerCase());
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.customer) await markPastDue(inv.customer as string);
        break;
      }
    }
  } catch (e) {
    // Return 500 so Stripe retries; log for investigation.
    console.error('billing webhook handler failed', event.type, (e as Error).message);
    return NextResponse.json({ error: 'handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
