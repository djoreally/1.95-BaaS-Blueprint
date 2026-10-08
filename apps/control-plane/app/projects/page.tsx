export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { currentUser } from '../../lib/auth';
import { prisma } from '../../lib/db';
import { hasHostedEntitlement } from '../../lib/billing';

const BASE_DOMAIN = 'invisibledb.app';

export default async function ProjectsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const requests = await prisma.provisionRequest.findMany({
    where: { userId: user.id, kind: 'provision' },
    orderBy: { createdAt: 'desc' },
  });

  const hasEntitlement = await hasHostedEntitlement(user.id);
  const activeInstances = requests.filter((r) => r.status === 'done');
  const pendingInstances = requests.filter((r) => ['pending', 'claimed'].includes(r.status));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#ff9f00', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Dashboard</div>
          <h1 style={{ margin: '4px 0 6px', fontSize: 'clamp(2rem, 7vw, 3.5rem)', lineHeight: 1 }}>Your Databases</h1>
          <p style={{ color: '#999', margin: 0 }}>Manage instances, connection details, auth, storage, vectors, realtime, backups, and settings.</p>
        </div>
        <a className="btn" href="/api/billing/portal" style={{ marginLeft: 'auto' }}>Manage billing</a>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12, marginBottom: 22 }}>
        <div className="card"><strong>{activeInstances.length}</strong><div style={{ color: '#888', marginTop: 4 }}>Ready databases</div></div>
        <div className="card"><strong>{pendingInstances.length}</strong><div style={{ color: '#888', marginTop: 4 }}>Provisioning</div></div>
        <div className="card"><strong>{hasEntitlement ? 'Active' : 'Inactive'}</strong><div style={{ color: '#888', marginTop: 4 }}>Subscription</div></div>
      </section>

      {pendingInstances.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--warn)' }}>
          <h3 style={{ marginTop: 0 }}>Provisioning</h3>
          {pendingInstances.map((r) => (
            <p key={r.id} style={{ margin: '0.5rem 0' }}>
              <strong>{r.slug}.{BASE_DOMAIN}</strong> — your database is being created (usually under 2 minutes).
            </p>
          ))}
        </div>
      )}

      {activeInstances.length === 0 && pendingInstances.length === 0 ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>No databases yet</h2>
          <p>
            {hasEntitlement
              ? 'Your subscription is active. Your first database will be provisioned automatically.'
              : 'Get started with your first database — $6.99/mo, first month $1.'}
          </p>
          {!hasEntitlement && (
            <a className="btn" href="/api/billing/checkout">Get your database →</a>
          )}
        </div>
      ) : (
        <section>
          <h2 style={{ marginBottom: 12 }}>Instances</h2>
          {activeInstances.map((r) => {
            const endpoint = `https://${r.slug}.${BASE_DOMAIN}`;
            return (
              <div className="card" key={r.id} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.3rem' }}>{r.slug}</strong>
                  <span className="badge up">READY</span>
                  <a className="btn" href={`/projects/${encodeURIComponent(r.slug)}`} style={{ marginLeft: 'auto' }}>Manage database →</a>
                </div>
                <div style={{ color: '#8d8d8d', fontSize: '0.9rem', marginTop: '0.75rem' }}>
                  API endpoint
                </div>
                <code style={{ display: 'block', marginTop: 4, color: '#ffb12b', overflowWrap: 'anywhere' }}>{endpoint}</code>
                <p style={{ fontSize: '0.82rem', color: '#777', marginBottom: 0 }}>
                  Protected API endpoint. Opening it directly in a browser without credentials will return an authentication error.
                </p>
              </div>
            );
          })}
        </section>
      )}

      <section id="connect" className="card" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>Connect an application</h2>
        <p style={{ color: '#999' }}>Choose a database above, then use its Connect section for SDK-specific setup.</p>
      </section>

      <section id="activity" className="card" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Activity</h2>
        <p style={{ color: '#999' }}>Provisioning state and database readiness are shown from the existing control-plane records. No backend changes were made for this dashboard restoration.</p>
      </section>
    </>
  );
}
