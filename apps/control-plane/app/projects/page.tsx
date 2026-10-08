export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { currentUser } from '../../lib/auth';
import { prisma } from '../../lib/db';
import { hasHostedEntitlement } from '../../lib/billing';

export default async function ProjectsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  // Unified instance list: both VPS (managed) and cPanel (BYOH) providers.
  // One instance model, one lifecycle — the provider is an implementation detail.
  const projects = await prisma.project.findMany({
    where: { userId: user.id, status: { not: 'deleted' } },
    orderBy: { createdAt: 'desc' },
  });

  // Also check for pending VPS provisions (not yet in Project table)
  const pendingRequests = await prisma.provisionRequest.findMany({
    where: { userId: user.id, kind: 'provision', status: { in: ['pending', 'claimed'] } },
    orderBy: { createdAt: 'desc' },
  });

  const hasEntitlement = await hasHostedEntitlement(user.id);
  const readyProjects = projects.filter((p) => p.status === 'ready');
  const provisioningProjects = projects.filter((p) => p.status === 'provisioning');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Your Databases</h1>
        <a className="btn" href="/api/billing/portal" style={{ marginLeft: 'auto' }}>Manage billing</a>
      </div>

      {(pendingRequests.length > 0 || provisioningProjects.length > 0) && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--warn)' }}>
          <h3 style={{ marginTop: 0 }}>Provisioning…</h3>
          {pendingRequests.map((r) => (
            <p key={r.id} style={{ margin: '0.5rem 0' }}>
              <strong>{r.slug}.invisibledb.app</strong> — your database is being created (usually under 2 minutes).
            </p>
          ))}
          {provisioningProjects.map((p) => (
            <p key={p.id} style={{ margin: '0.5rem 0' }}>
              <strong>{p.fqdn}</strong> — provisioning via {p.provider === 'vps' ? 'InvisibleDB Cloud' : 'your hosting'}.
            </p>
          ))}
        </div>
      )}

      {readyProjects.length === 0 && pendingRequests.length === 0 && provisioningProjects.length === 0 ? (
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
        readyProjects.map((p) => {
          const url = `https://${p.fqdn}`;
          const providerLabel = p.provider === 'vps' ? 'InvisibleDB Cloud' : 'BYOH';
          return (
            <div className="card" key={p.id} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ fontSize: '1.15rem' }}>{p.name}</strong>
                <span className="badge up">READY</span>
                <span className="badge">{providerLabel}</span>
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
