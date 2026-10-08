export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { currentUser } from '../../lib/auth';
import { prisma } from '../../lib/db';
import { hasHostedEntitlement } from '../../lib/billing';

const BASE_DOMAIN = 'invisibledb.app';

export default async function ProjectsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  // User's databases: provision requests they've made
  const requests = await prisma.provisionRequest.findMany({
    where: { userId: user.id, kind: 'provision' },
    orderBy: { createdAt: 'desc' },
  });

  const hasEntitlement = await hasHostedEntitlement(user.id);
  const activeInstances = requests.filter((r) => r.status === 'done');
  const pendingInstances = requests.filter((r) => ['pending', 'claimed'].includes(r.status));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Your Databases</h1>
        <span className="badge up">InvisibleDB Cloud</span>
        <a className="btn" href="/api/billing/portal" style={{ marginLeft: 'auto' }}>Manage billing</a>
      </div>

      {pendingInstances.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--warn)' }}>
          <h3 style={{ marginTop: 0 }}>Provisioning…</h3>
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
        activeInstances.map((r) => {
          const url = `https://${r.slug}.${BASE_DOMAIN}`;
          return (
            <div className="card" key={r.id} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ fontSize: '1.15rem' }}>{r.slug}</strong>
                <span className="badge up">READY</span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.92rem', marginTop: '0.35rem' }}>
                <a href={url} target="_blank" rel="noreferrer">{url}</a>
              </div>
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Connect with the SDK</summary>
                <pre style={{ fontSize: '0.82rem', overflowX: 'auto', marginTop: '0.5rem' }}>
{`import { InvisibleDB } from 'invisibledb';

const db = new InvisibleDB({
  baseUrl: '${url}',
  apiKey: process.env.INVISIBLEDB_KEY,
});`}
                </pre>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Your API key was shown when the database was provisioned. Store it in an environment variable — never in client-side code.
                </p>
              </details>
            </div>
          );
        })
      )}
    </>
  );
}
