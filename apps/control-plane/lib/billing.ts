import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from './db';

const STRIPE_API = 'https://api.stripe.com/v1';
const WEBHOOK_TOLERANCE_SECONDS = 300;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function billingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_ID &&
    process.env.STRIPE_FIRST_MONTH_COUPON_ID &&
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://baas.innovarel.dev').replace(/\/$/, '');
}

async function stripePost(path: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requiredEnv('STRIPE_SECRET_KEY')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error?.message || `Stripe request failed (${res.status})`);
  }
  return payload;
}

export async function createHostedCheckout(user: { id: string; email: string; name: string | null }) {
  const existing = await prisma.billingSubscription.findFirst({
    where: { userId: user.id, stripeCustomerId: { not: null } },
    orderBy: { updatedAt: 'desc' },
  });

  const params: Record<string, string> = {
    mode: 'subscription',
    ui_mode: 'hosted_page',
    origin_context: 'web',
    success_url: `${appUrl()}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/pricing?checkout=canceled`,
    client_reference_id: user.id,
    'line_items[0][price]': requiredEnv('STRIPE_PRICE_ID'),
    'line_items[0][quantity]': '1',
    'discounts[0][coupon]': requiredEnv('STRIPE_FIRST_MONTH_COUPON_ID'),
    'metadata[user_id]': user.id,
    'metadata[product]': 'invisibledb',
    'subscription_data[metadata][user_id]': user.id,
    'subscription_data[metadata][product]': 'invisibledb',
    'subscription_data[billing_mode][type]': 'flexible',
    submit_type: 'subscribe',
    billing_address_collection: 'auto',
  };

  if (existing?.stripeCustomerId) params.customer = existing.stripeCustomerId;
  else params.customer_email = user.email;

  return stripePost('/checkout/sessions', params) as Promise<{ id: string; url: string | null }>;
}

export async function createBillingPortal(userId: string) {
  const subscription = await prisma.billingSubscription.findFirst({
    where: { userId, stripeCustomerId: { not: null } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!subscription?.stripeCustomerId) throw new Error('No Stripe customer exists for this account.');

  return stripePost('/billing_portal/sessions', {
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl()}/projects`,
  }) as Promise<{ url: string }>;
}

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: any };
};

export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null): StripeEvent {
  if (!signatureHeader) throw new Error('Missing Stripe-Signature header');
  const secret = requiredEnv('STRIPE_WEBHOOK_SECRET');
  const pieces = signatureHeader.split(',');
  const timestamp = pieces.find((p) => p.startsWith('t='))?.slice(2);
  const signatures = pieces.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) throw new Error('Invalid Stripe signature header');

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) throw new Error('Invalid Stripe webhook timestamp');
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error('Stripe webhook timestamp is outside the allowed tolerance');
  }

  const expectedHex = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expected = Buffer.from(expectedHex, 'hex');
  const valid = signatures.some((candidate) => {
    try {
      const actual = Buffer.from(candidate, 'hex');
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  });
  if (!valid) throw new Error('Invalid Stripe webhook signature');

  return JSON.parse(rawBody) as StripeEvent;
}

function asDate(unixSeconds: unknown): Date | null {
  return typeof unixSeconds === 'number' && unixSeconds > 0 ? new Date(unixSeconds * 1000) : null;
}

function subscriptionIdFromInvoice(invoice: any): string | null {
  if (typeof invoice?.subscription === 'string') return invoice.subscription;
  const nested = invoice?.parent?.subscription_details?.subscription;
  return typeof nested === 'string' ? nested : null;
}

async function upsertSubscriptionFromCheckout(event: StripeEvent, session: any) {
  const userId = session?.client_reference_id || session?.metadata?.user_id;
  const subscriptionId = typeof session?.subscription === 'string' ? session.subscription : null;
  const customerId = typeof session?.customer === 'string' ? session.customer : null;
  if (!userId || !subscriptionId) return;

  const paid = session?.payment_status === 'paid' || session?.status === 'complete';
  await prisma.billingSubscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    update: {
      userId,
      stripeCustomerId: customerId,
      stripePriceId: process.env.STRIPE_PRICE_ID || null,
      status: paid ? 'active' : 'incomplete',
      entitlementActive: paid,
      lastStripeEventAt: new Date(event.created * 1000),
    },
    create: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: process.env.STRIPE_PRICE_ID || null,
      status: paid ? 'active' : 'incomplete',
      entitlementActive: paid,
      lastStripeEventAt: new Date(event.created * 1000),
    },
  });
}

async function upsertSubscriptionObject(event: StripeEvent, subscription: any) {
  const userId = subscription?.metadata?.user_id;
  const subscriptionId = subscription?.id;
  if (!userId || !subscriptionId) return;
  const status = String(subscription?.status || 'incomplete');
  const entitlementActive = status === 'active' || status === 'trialing';
  const priceId = subscription?.items?.data?.[0]?.price?.id || process.env.STRIPE_PRICE_ID || null;

  await prisma.billingSubscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    update: {
      userId,
      stripeCustomerId: typeof subscription?.customer === 'string' ? subscription.customer : null,
      stripePriceId: priceId,
      status,
      entitlementActive,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      currentPeriodEnd: asDate(subscription?.current_period_end),
      lastStripeEventAt: new Date(event.created * 1000),
    },
    create: {
      userId,
      stripeCustomerId: typeof subscription?.customer === 'string' ? subscription.customer : null,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      status,
      entitlementActive,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      currentPeriodEnd: asDate(subscription?.current_period_end),
      lastStripeEventAt: new Date(event.created * 1000),
    },
  });
}

async function applyInvoiceState(event: StripeEvent, invoice: any, paid: boolean) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;
  await prisma.billingSubscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      status: paid ? 'active' : 'past_due',
      entitlementActive: paid,
      lastStripeEventAt: new Date(event.created * 1000),
    },
  });
}

export async function applyStripeEvent(event: StripeEvent): Promise<void> {
  const object = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
      await upsertSubscriptionFromCheckout(event, object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertSubscriptionObject(event, object);
      break;
    case 'invoice.paid':
      await applyInvoiceState(event, object, true);
      break;
    case 'invoice.payment_failed':
      await applyInvoiceState(event, object, false);
      break;
    default:
      break;
  }
}

export async function hasHostedEntitlement(userId: string): Promise<boolean> {
  const active = await prisma.billingSubscription.findFirst({
    where: { userId, entitlementActive: true },
    select: { id: true },
  });
  return Boolean(active);
}
