export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { currentUser } from '../../../lib/auth';
import { hasHostedEntitlement } from '../../../lib/billing';

export default async function BillingSuccessPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const active = await hasHostedEntitlement(user.id);

  return (
    <div className="card" style={{ maxWidth: 620, margin: '2rem auto' }}>
      <h1>{active ? 'Payment confirmed' : 'Payment received'}</h1>
      {active ? (
        <>
          <p>Your InvisibleDB hosted seat is active. You can provision your backend now.</p>
          <a className="btn" href="/projects/new">Create your hosted project →</a>
        </>
      ) : (
        <>
          <p>
            Stripe has returned you to InvisibleDB, but we are still waiting for the signed billing webhook
            that activates your hosted entitlement. Provisioning stays locked until that confirmation arrives.
          </p>
          <a className="btn" href="/billing/success">Check payment status again</a>
        </>
      )}
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '1rem' }}>
        Need to update a card or manage the subscription later? Use <a href="/api/billing/portal">Manage billing</a>.
      </p>
    </div>
  );
}
