export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { currentUser } from '../../../lib/auth';
import { prisma } from '../../../lib/db';

const BASE_DOMAIN = 'invisibledb.app';

export default async function DatabaseDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { slug } = await params;
  const request = await prisma.provisionRequest.findFirst({
    where: { userId: user.id, kind: 'provision', slug },
    orderBy: { createdAt: 'desc' },
  });

  if (!request) notFound();

  const endpoint = `https://${slug}.${BASE_DOMAIN}`;
  const ready = request.status === 'done';

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <a href="/projects" style={{ color: '#999', textDecoration: 'none', fontSize: 14 }}>← All databases</a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 8vw, 3.4rem)' }}>{slug}</h1>
          <span className={`badge ${ready ? 'up' : ''}`}>{ready ? 'READY' : request.status.toUpperCase()}</span>
        </div>
        <div style={{ marginTop: 8, color: '#858585' }}>InvisibleDB Cloud database</div>
      </div>

      <nav style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
        {['overview','connect','auth','database','storage','vector','realtime','backups','settings'].map((item) => (
          <a key={item} href={`#${item}`} style={{ whiteSpace: 'nowrap', padding: '8px 12px', border: '1px solid #292929', borderRadius: 999, color: '#d3d3d3', textDecoration: 'none', fontSize: 13, textTransform: 'capitalize' }}>{item}</a>
        ))}
      </nav>

      <section id="overview" className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Overview</h2>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Metric label="Status" value={ready ? 'Ready' : request.status} />
          <Metric label="Provider" value="InvisibleDB Cloud" />
          <Metric label="Region" value="Managed VPS" />
          <Metric label="Created" value={new Date(request.createdAt).toLocaleDateString()} />
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>API endpoint</div>
          <code style={{ color: '#ffb12b', overflowWrap: 'anywhere' }}>{endpoint}</code>
          <p style={{ color: '#777', fontSize: 13, marginBottom: 0 }}>This is a protected API endpoint, not a website. A browser request without credentials returns an authentication error.</p>
        </div>
      </section>

      <section id="connect" className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Connect</h2>
        <p style={{ color: '#aaa' }}>Use your database endpoint with an InvisibleDB SDK. Keep instance API keys in trusted server environments. Mobile apps should use end-user auth rather than embedding the instance key.</p>
        <pre style={{ overflowX: 'auto', fontSize: 13, padding: 14, background: '#0b0b0b', borderRadius: 10 }}>{`import { InvisibleDB } from 'invisibledb';

const db = new InvisibleDB({
  baseUrl: '${endpoint}',
  apiKey: process.env.INVISIBLEDB_KEY,
});`}</pre>
        <a href="/docs" style={{ color: '#ff9f00' }}>Open SDK documentation →</a>
      </section>

      <FeatureSection id="auth" title="Auth" description="User authentication and collection access rules are provided by the database runtime. Configure client-safe user authentication for web and mobile applications." />
      <FeatureSection id="database" title="Database" description="Your primary application data lives in the isolated database instance. CRUD, filtering, sorting, pagination, and collection APIs are available through the SDK and REST API." />
      <FeatureSection id="storage" title="Storage" description="File fields and record-attached uploads are supported through the instance API and SDK file helpers." />
      <FeatureSection id="vector" title="Vector" description="Vector search is part of the InvisibleDB platform surface. Use the SDK vector query API when vector support is enabled for the instance." />
      <FeatureSection id="realtime" title="Realtime" description="Realtime subscriptions are available to supported SDKs through the instance realtime API." />
      <FeatureSection id="backups" title="Backups" description="Backups are managed by the InvisibleDB infrastructure. Customer-facing restore controls are not exposed on this screen yet." />

      <section id="settings" className="card" style={{ marginBottom: 14 }}>
        <h2 style={{ marginTop: 0 }}>Settings</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a className="btn" href="/api/billing/portal">Manage billing</a>
          <a href="/docs" style={{ padding: '10px 14px', color: '#ddd', border: '1px solid #333', borderRadius: 8, textDecoration: 'none' }}>API documentation</a>
        </div>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #282828', borderRadius: 10, padding: 14, background: '#101010' }}>
      <div style={{ color: '#777', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ marginTop: 5, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function FeatureSection({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <section id={id} className="card" style={{ marginBottom: 14 }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: '#aaa', marginBottom: 0 }}>{description}</p>
    </section>
  );
}
