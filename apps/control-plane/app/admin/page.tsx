import { redirect } from 'next/navigation';
import { prisma } from '../../lib/db';
import { requireAdmin, clearSessionCookie } from '../../lib/auth';

export const metadata = { title: 'Admin — InvisibleDB' };
export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default async function AdminDashboard() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    redirect('/admin/login');
  }

  const [subCount, activeSubs, reqPending, reqFailed, userCount, projCount] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.provisionRequest.count({ where: { status: { in: ['pending', 'claimed'] } } }),
    prisma.provisionRequest.count({ where: { status: 'failed' } }),
    prisma.user.count(),
    prisma.project.count(),
  ]);

  const recentSubs = await prisma.subscription.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
  const recentReqs = await prisma.provisionRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });

  async function logout() {
    'use server';
    await clearSessionCookie();
    redirect('/admin/login');
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin <span style={{ color: 'var(--muted)', fontSize: '1rem' }}>· {admin.email}</span></h1>
        <form action={logout}><button className="btn" type="submit">Log out</button></form>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Pulse</h3>
        <Row label="Subscriptions (total / active)" value={`${subCount} / ${activeSubs}`} />
        <Row label="Provision queue (open)" value={reqPending} />
        <Row label="Provision failed" value={reqFailed} />
        <Row label="Users" value={userCount} />
        <Row label="BYOH projects" value={projCount} />
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Latest subscriptions</h3>
        {recentSubs.length === 0 && <p style={{ color: 'var(--muted)' }}>None yet.</p>}
        {recentSubs.map((s) => (
          <Row key={s.id} label={`${s.email} → ${s.slug ?? 'provisioning…'}`} value={s.status} />
        ))}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Provision queue</h3>
        {recentReqs.length === 0 && <p style={{ color: 'var(--muted)' }}>Queue empty.</p>}
        {recentReqs.map((r) => (
          <Row key={r.id} label={`${r.kind} ${r.slug} (${r.email})`} value={`${r.status}${r.attempts > 1 ? ` · ${r.attempts}x` : ''}`} />
        ))}
      </div>
    </div>
  );
}
