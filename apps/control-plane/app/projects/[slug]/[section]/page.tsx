export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { currentUser } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';

const BASE_DOMAIN = 'invisibledb.app';
const SECTIONS = new Set(['overview','connect','auth','database','storage','vector','realtime','backups','settings']);

export default async function DatabaseSection({ params }: { params: Promise<{ slug: string; section: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { slug, section } = await params;
  if (!SECTIONS.has(section)) notFound();

  const request = await prisma.provisionRequest.findFirst({
    where: { userId: user.id, kind: 'provision', slug },
    orderBy: { createdAt: 'desc' },
  });
  if (!request) notFound();

  const endpoint = `https://${slug}.${BASE_DOMAIN}`;
  const ready = request.status === 'done';

  return (
    <div>
      <a href="/projects" style={{ color: '#8f8f8f', textDecoration: 'none', fontSize: 14 }}>← Databases</a>
      <div style={{ marginTop: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(2rem,7vw,3.2rem)' }}>{slug}</h1>
          <span className={`badge ${ready ? 'up' : ''}`}>{ready ? 'READY' : request.status.toUpperCase()}</span>
        </div>
        <p style={{ color: '#7f7f7f', margin: '8px 0 0' }}>InvisibleDB Cloud database</p>
      </div>

      {section === 'overview' && <Overview endpoint={endpoint} status={ready ? 'Ready' : request.status} created={new Date(request.createdAt).toLocaleDateString()} />}
      {section === 'connect' && <Connect endpoint={endpoint} slug={slug} />}
      {section === 'auth' && <Info title="Authentication" body="Use collection-user authentication for web and mobile clients. Keep the instance API key out of shipped client bundles. Authentication rules are enforced by the isolated database runtime." />}
      {section === 'database' && <Info title="Database" body="CRUD, filtering, sorting, pagination, relations, and collection APIs are available through the InvisibleDB SDKs and REST API. Database administration actions will live here as they are exposed by the control plane." />}
      {section === 'storage' && <Info title="Storage" body="Record-attached files are supported through multipart uploads and SDK file helpers. This section will surface storage usage and file management when those control-plane metrics are available." />}
      {section === 'vector' && <Info title="Vector search" body="InvisibleDB supports vector query operations through the SDK contract. This page will expose index status and usage only when the runtime reports those capabilities; it does not invent state." />}
      {section === 'realtime' && <Info title="Realtime" body="Realtime subscriptions are available through supported SDKs. Connection state and event diagnostics belong here once telemetry is exposed by the instance gateway." />}
      {section === 'backups' && <Info title="Backups" body="Backups are infrastructure-managed today. Restore controls are intentionally not shown until there is a real restore API and audited restore workflow behind them." />}
      {section === 'settings' && <Settings />}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="card" style={{ marginBottom: 16 }}>{children}</section>;
}

function Overview({ endpoint, status, created }: { endpoint: string; status: string; created: string }) {
  return <>
    <Panel>
      <h2 style={{ marginTop: 0 }}>Overview</h2>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <Metric label="Status" value={status} />
        <Metric label="Provider" value="InvisibleDB Cloud" />
        <Metric label="Runtime" value="Managed VPS" />
        <Metric label="Created" value={created} />
      </div>
    </Panel>
    <Panel>
      <h2 style={{ marginTop: 0 }}>API endpoint</h2>
      <code style={{ color: '#ffae1a', overflowWrap: 'anywhere' }}>{endpoint}</code>
      <p style={{ color: '#888', marginBottom: 0 }}>This is a protected API endpoint. Opening it directly in a browser without credentials is expected to return an authentication error.</p>
    </Panel>
  </>;
}

function Connect({ endpoint, slug }: { endpoint: string; slug: string }) {
  return <>
    <Panel>
      <h2 style={{ marginTop: 0 }}>Connect your application</h2>
      <p style={{ color: '#aaa' }}>Use the SDK that matches your application. Server runtimes may use the instance API key. Mobile applications should authenticate end users and never ship the instance key in the bundle.</p>
      <pre style={{ overflowX: 'auto', background: '#0b0b0b', border: '1px solid #202020', borderRadius: 10, padding: 14, fontSize: 13 }}>{`import { InvisibleDB } from 'invisibledb';\n\nconst db = new InvisibleDB({\n  baseUrl: '${endpoint}',\n  apiKey: process.env.INVISIBLEDB_KEY,\n});`}</pre>
      <a href="/dashboard/docs" style={{ color: '#ff9f00' }}>Open documentation inside the control panel →</a>
    </Panel>
    <Panel><h2 style={{ marginTop: 0 }}>Instance</h2><p style={{ color: '#aaa', marginBottom: 0 }}>Database: <strong>{slug}</strong></p></Panel>
  </>;
}

function Settings() {
  return <Panel>
    <h2 style={{ marginTop: 0 }}>Settings</h2>
    <p style={{ color: '#aaa' }}>Only actions backed by real control-plane APIs belong here.</p>
    <a className="btn" href="/dashboard/billing">Billing settings</a>
  </Panel>;
}

function Info({ title, body }: { title: string; body: string }) {
  return <Panel><h2 style={{ marginTop: 0 }}>{title}</h2><p style={{ color: '#aaa', marginBottom: 0, lineHeight: 1.65 }}>{body}</p></Panel>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid #282828', borderRadius: 10, padding: 14, background: '#101010' }}><div style={{ color: '#777', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div><div style={{ marginTop: 5, fontWeight: 800 }}>{value}</div></div>;
}
