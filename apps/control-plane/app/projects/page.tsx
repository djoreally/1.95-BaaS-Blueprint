export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { currentUser } from '../../lib/auth';
import { listUserJobs } from '../../lib/user-projects';
import { getByohConnection, getPlatformConnection, normalizeHostingMode } from '../../lib/hosting';

export default async function ProjectsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const jar = await cookies();
  const hostingMode = normalizeHostingMode(jar.get('baas_hosting_mode')?.value);
  const conn = hostingMode === 'HOSTED' ? await getPlatformConnection() : await getByohConnection(user.id);
  const projects = await listUserJobs(user.id);

  if (!conn) {
    return (
      <div className="card">
        <h2>{hostingMode === 'HOSTED' ? 'Managed hosting is being configured' : 'Connect hosting first'}</h2>
        <p>{hostingMode === 'HOSTED' ? 'Your account is ready, but the platform hosting connection is not configured yet.' : 'Connect your cPanel account once and every BYOH project provisions there.'}</p>
        {hostingMode === 'BYOH' && <a className="btn" href="/connect">Connect hosting →</a>}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Projects</h1>
        <span className="badge up">{hostingMode === 'HOSTED' ? 'Managed hosting' : conn.host}</span>
        <a className="btn" href="/projects/new" style={{ marginLeft: 'auto' }}>+ New project</a>
      </div>
      {projects.length === 0 ? (
        <div className="card"><p>No projects yet.</p><a className="btn" href="/projects/new">New project →</a></div>
      ) : (
        projects.map((p) => (
          <div className="card" key={p.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ fontSize: '1.15rem' }}><a href={`/projects/${p.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{p.name}</a></strong>
              <span className={`badge ${p.status === 'ready' ? 'up' : p.status === 'failed' ? 'down' : 'pending'}`}>{p.status.toUpperCase()}</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.92rem', marginTop: '0.35rem' }}><a href={`https://${p.fqdn}`} target="_blank" rel="noreferrer">{p.fqdn}</a>{' '}· port {p.port}</div>
          </div>
        ))
      )}
    </>
  );
}
