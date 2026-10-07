/**
 * Hosted billing helpers — Stripe <-> subscription <-> VPS provision queue.
 * Webhook route lives at app/api/billing/webhook/route.ts.
 */
import { randomBytes } from 'crypto';
import { prisma } from './db';

/** Slug for <slug>.BASE_DOMAIN: from the local part of the email, sanitized. */
export function slugForEmail(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const safe = base || 'db';
  return `${safe}-${randomBytes(3).toString('hex')}`;
}

export async function upsertSubscription(opts: {
  email: string;
  stripeCustomerId: string;
  stripeSubId?: string;
}) {
  return prisma.subscription.upsert({
    where: { email: opts.email },
    update: { stripeCustomerId: opts.stripeCustomerId, stripeSubId: opts.stripeSubId ?? undefined, status: 'active' },
    create: { email: opts.email, stripeCustomerId: opts.stripeCustomerId, stripeSubId: opts.stripeSubId },
  });
}

export async function queueProvision(email: string, slug: string) {
  await prisma.subscription.update({ where: { email }, data: { slug } });
  return prisma.provisionRequest.create({ data: { kind: 'provision', email, slug } });
}

export async function queueDeprovision(email: string) {
  const sub = await prisma.subscription.findUnique({ where: { email } });
  if (!sub?.slug) return null;
  await prisma.subscription.update({ where: { email }, data: { status: 'cancelled' } });
  return prisma.provisionRequest.create({ data: { kind: 'deprovision', email, slug: sub.slug } });
}

export async function markPastDue(stripeCustomerId: string) {
  return prisma.subscription.updateMany({
    where: { stripeCustomerId },
    data: { status: 'past_due' },
  });
}
