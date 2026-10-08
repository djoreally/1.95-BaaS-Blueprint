import { redirect } from 'next/navigation';
import { prisma } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

export const metadata = { title: 'Integrations — InvisibleDB Admin' };
export const dynamic = 'force-dynamic';

interface Check {
  name: string;
  status: 'ok' | 'missing' | 'down' | 'unknown';
  detail: string;
}

function Dot({ status }: { status: Check['status'] }) {
  const color =
    status === 'ok' ? '#22c55e' : status === 'missing' ? '#f59e0b' : status === 'down' ? '#ef4444' : '#71717a';
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 8 }} />;
}

async function checkVps(): Promise<Check> {
  const ip = '66.23.224.55';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    // Port 443: fresh box refuses until Caddy is up; a timeout means down/firewalled.
    await fetch(`https://${ip}/`, { signal: ctrl.signal, redirect: 'manual' }).catch((e) => {
      if (e?.cause && String(e.cause).includes('ECONNREFUSED')) throw { refused: true };
      throw e;
    });
    clearTimeout(t);
    return { name: 'VPS (66.23.224.55)', status: 'ok', detail: 'HTTPS responding' };
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'refused' in e) {
      return { name: 'VPS (66.23.224.55)', status: 'unknown', detail: 'Host up, nothing on 443 yet — deploy the stack' };
    }
    return { name: 'VPS (66.23.224.55)', status: 'down', detail: 'Unreachable (setup may still be pending)' };
  }
}

export default async function IntegrationsPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/admin/login');
  }

  const checks: Check[] = [
    {
      name: 'Stripe secret key',
      status: process.env.STRIPE_SECRET_KEY ? 'ok' : 'missing',
      detail: process.env.STRIPE_SECRET_KEY ? 'Set' : 'Set STRIPE_SECRET_KEY in Vercel env',
    },
    {
      name: 'Stripe price ($6.99/mo)',
      status: process.env.STRIPE_PRICE_ID ? 'ok' : 'missing',
      detail: process.env.STRIPE_PRICE_ID ? 'Set' : 'Create the product in Stripe dashboard first',
    },
    {
      name: 'Stripe webhook secret',
      status: process.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'missing',
      detail: process.env.STRIPE_WEBHOOK_SECRET ? 'Set' : 'Add the webhook endpoint in Stripe dashboard first',
    },
    {
      name: 'Session secret',
      status: process.env.SESSION_SECRET ? 'ok' : 'missing',
      detail: process.env.SESSION_SECRET ? 'Set' : 'Required for admin login — generate with openssl rand -hex 32',
    },
    {
      name: 'VPS poller secret',
      status: process.env.VPS_API_SECRET ? 'ok' : 'missing',
      detail: process.env.VPS_API_SECRET ? 'Set (must match /srv/idb/.env)' : 'Generate and set on both ends',
    },
    await checkVps(),
  ];

  // Database liveness — the one check that touches Neon.
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'Database (Neon)', status: 'ok', detail: 'Connected' });
  } catch {
    checks.push({ name: 'Database (Neon)', status: 'down', detail: 'Query failed — check DATABASE_URL' });
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Integrations</h1>
      <p style={{ color: 'var(--muted)' }}>Live status of everything the platform depends on.</p>
      <div className="card" style={{ marginTop: '1rem' }}>
        {checks.map((c) => (
          <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid var(--line)' }}>
            <span><Dot status={c.status} />{c.name}</span>
            <span style={{ color: 'var(--muted)', textAlign: 'right', maxWidth: '60%' }}>{c.detail}</span>
          </div>
        ))}
      </div>
      <p style={{ marginTop: '1rem' }}>
        <a href="/admin">← Back to admin</a>
      </p>
    </div>
  );
}
