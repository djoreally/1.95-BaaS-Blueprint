export default function DashboardBillingPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#ff9f00', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Account</div>
        <h1 style={{ margin: '8px 0 6px', fontSize: 'clamp(2rem,7vw,3.2rem)' }}>Billing</h1>
        <p style={{ color: '#8b8b8b', maxWidth: 720, lineHeight: 1.65 }}>Billing stays part of the control-panel navigation. Secure payment-method and subscription changes are handled in the Stripe customer portal.</p>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Subscription management</h2>
        <p style={{ color: '#999', lineHeight: 1.6 }}>Use the secure billing portal to update payment methods, review invoices, or manage the subscription. When you finish, return to the InvisibleDB control panel.</p>
        <a className="btn" href="/api/billing/portal">Open secure billing portal →</a>
      </section>
    </div>
  );
}
