export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getJob } from '../../../lib/projects';
import ProvisioningFeed from '../../../components/ProvisioningFeed';
import ProjectTabs from '../../../components/ProjectTabs';
import { RevealSecret, DeleteProjectButton } from '../../../components/ProjectWidgets';

async function checkHealth(fqdn: string): Promise<'up' | 'down'> {
  try {
    const res = await fetch(`https://${fqdn}/api/health`, {
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

const WATCHDOG_CRON = '*/2 * * * * $HOME/baas/bin/watchdog.sh >> $HOME/baas/logs/watchdog.log 2>&1';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();

  if (job.status !== 'ready') {
    return (
      <>
        <p><a href="/projects">← Projects</a></p>
        <ProvisioningFeed id={job.id} />
      </>
    );
  }

  const health = await checkHealth(job.fqdn);
  const r = job.result!;
  const base = `https://${job.fqdn}`;

  const tabs = [
    {
      id: 'overview', label: 'Overview',
      content: (
        <div className="card">
          <dl className="kv">
            <dt>Public URL</dt><dd><a href={base} target="_blank" rel="noreferrer">{base}</a></dd>
            <dt>API health</dt><dd><span className={`badge ${health}`}>{health === 'up' ? '● LIVE' : '● DOWN'}</span>{' '}<code className="inline">{base}/api/health</code></dd>
            <dt>Backend port</dt><dd>127.0.0.1:{job.port} (loopback only — Apache proxies in)</dd>
            <dt>Document root</dt><dd><code className="inline">{r.docRoot}</code></dd>
            <dt>SSL</dt><dd>{r.sslPending ? (<span className="badge pending">PENDING</span>) : (<span className="badge up">ACTIVE</span>)}{' '}
              {r.sslPending && 'AutoSSL usually lands within minutes; the proxy serves HTTP meanwhile.'}</dd>
          </dl>
          {r.cronSkipped && (
            <div className="callout warn">
              <strong>One manual step: the watchdog cron.</strong> The hosting API can&apos;t install cron
              jobs on this host, so the supervisor&apos;s 2-minute watchdog needs one cron line —
              add it once in your hosting panel&apos;s cron manager:
              <pre className="code" style={{ marginTop: '0.6rem' }}>{WATCHDOG_CRON}</pre>
              Until then, the backend runs fine but won&apos;t auto-restart after a crash.
            </div>
          )}
          {job.note && <div className="callout">{job.note}</div>}
        </div>
      ),
    },
    {
      id: 'api', label: 'API keys',
      content: (
        <div className="card">
          <h2>API access</h2>
          <p>
            This project runs <strong>PocketBase</strong> — auth, realtime database, and file storage
            behind one REST API. There are no platform API keys to manage: secure the backend by
            creating an admin account in the <a href={`${base}/_/`} target="_blank" rel="noreferrer">admin UI</a>,
            then use collection API rules.
          </p>
          <pre className="code">{`import PocketBase from 'pocketbase';
const pb = new PocketBase('${base}');
// auth, realtime, files — full SDK:
await pb.collection('users').authWithPassword(email, password);`}</pre>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Admin UI: <a href={`${base}/_/`} target="_blank" rel="noreferrer">{base}/_/</a> ·
            Health: <a href={`${base}/api/health`} target="_blank" rel="noreferrer">{base}/api/health</a>
          </p>
        </div>
      ),
    },
    {
      id: 'auth', label: 'Auth',
      content: (
        <div className="card">
          <h2>Authentication</h2>
          <p>
            PocketBase ships built-in auth: email/password, OAuth2 providers, OTP, and per-collection
            API rules. Manage users and rules in the <a href={`${base}/_/`} target="_blank" rel="noreferrer">admin UI</a> —
            no extra service to configure.
          </p>
          <pre className="code">{`// password auth
await pb.collection('users').authWithPassword('you@co.com', 'secret');
// auth store persists; pb.authStore.isValid to check`}</pre>
        </div>
      ),
    },
    {
      id: 'database', label: 'Database',
      content: (
        <div className="card">
          <h2>MySQL — project database</h2>
          <p>One isolated MySQL identity per project, created by the provisioner:</p>
          <dl className="kv">
            <dt>Database</dt><dd><code className="inline">{r.db.name}</code></dd>
            <dt>User</dt><dd><code className="inline">{r.db.user}</code></dd>
            <dt>Host</dt><dd><code className="inline">localhost</code> (connect from the project backend on this box)</dd>
            <dt>Password</dt><dd>{job.dbPassword ? <RevealSecret label="password" value={job.dbPassword} /> : <em>Generated at provisioning (seeded demo — see your records)</em>}</dd>
          </dl>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Your app&apos;s primary store is PocketBase&apos;s embedded SQLite; this MySQL database is
            yours for relational workloads alongside it.
          </p>
        </div>
      ),
    },
    {
      id: 'storage', label: 'Storage',
      content: (
        <div className="card">
          <h2>File storage</h2>
          <p>
            PocketBase file storage lives in the project&apos;s <code className="inline">pb_data/storage</code> on
            your hosting — thumbnails, S3-compatible API, per-collection rules. Files are part of the
            backup story below.
          </p>
        </div>
      ),
    },
    {
      id: 'vector', label: 'Vector',
      content: (
        <div className="card">
          <h2>Vector / RAG</h2>
          <p>
            Default: <strong>sqlite-vec</strong> — vector search inside the project&apos;s own SQLite
            database, no extra service. Good to ~100k vectors per project.
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Scale exits when you need them: MySQL 8 JSON fallback on this host, in-memory HNSW for
            millions of vectors. Per-project token-authed endpoint ships with the vector tier.
          </p>
        </div>
      ),
    },
    {
      id: 'backups', label: 'Backups',
      content: (
        <div className="card">
          <h2>Backups</h2>
          <p>
            Plan: <strong>Litestream</strong> continuously replicates each project&apos;s SQLite to
            cheap object storage (R2/B2), with point-in-time restore. Same story covers uploaded files.
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Status: replication agent ships with the backup tier — the database files are yours today,
            downloadable any time. Nothing is held hostage.
          </p>
        </div>
      ),
    },
    {
      id: 'logs', label: 'Logs',
      content: (
        <div className="card">
          <h2>Provisioning log</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Every hosting-API call the provisioner made, in order (secrets scrubbed by the adapter):
          </p>
          {r.callLog.length === 0 ? (
            <p><em>No call log recorded for this project (seeded before call-log capture).</em></p>
          ) : (
            <pre className="code">{r.callLog.map((c, i) => `${String(i + 1).padStart(2)}. [v${c.apiVersion}] ${c.module}::${c.func}`).join('\n')}</pre>
          )}
        </div>
      ),
    },
    {
      id: 'settings', label: 'Settings',
      content: (
        <div className="card">
          <h2>Danger zone</h2>
          <DeleteProjectButton id={job.id} name={job.name} />
        </div>
      ),
    },
  ];

  return (
    <>
      <p><a href="/projects">← Projects</a></p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>{job.name}</h1>
        <span className={`badge ${health}`}>{health === 'up' ? '● LIVE' : '● DOWN'}</span>
        {job.seeded && <span className="badge pending">LIVE DEMO</span>}
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        <a href={base} target="_blank" rel="noreferrer">{job.fqdn}</a> · port {job.port}
      </p>
      <ProjectTabs tabs={tabs} />
    </>
  );
}
