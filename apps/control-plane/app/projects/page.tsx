import { listJobs } from '../../lib/projects';
import { getConnection } from '../../lib/connection';

/** Project dashboard home — every project, live status. */
export default async function ProjectsPage() {
  const conn = getConnection();
  const projects = listJobs();

  if (!conn) {
    return (
      <div className="card">
        <h2>Connect hosting first</h2>
        <p>
          Projects live on <em>your</em> cPanel account — connect it once and
          every project provisions there.
        </p>
        <a className="btn" href="/connect">Connect hosting →</a>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Projects</h1>
        <span className="badge up">{conn.host}</span>
        <a className="btn" href="/projects/new" style={{ marginLeft: 'auto' }}>+ New project</a>
      </div>
      {projects.length === 0 ? (
        <div className="card">
          <p>No projects yet. Create one — subdomain, database, SSL, and a live backend in about seven minutes.</p>
          <a className="btn" href="/projects/new">New project →</a>
        </div>
      ) : (
        projects.map((p) => (
          <div className="card" key={p.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <strong style={{ fontSize: '1.15rem' }}>
                <a href={`/projects/${p.id}`} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{p.name}</a>
              </strong>
              <span className={`badge ${p.status === 'ready' ? 'up' : p.status === 'failed' ? 'down' : 'pending'}`}>
                {p.status.toUpperCase()}
              </span>
              {p.seeded && <span className="badge pending">LIVE DEMO</span>}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.92rem', marginTop: '0.35rem' }}>
              <a href={`https://${p.fqdn}`} target="_blank" rel="noreferrer">{p.fqdn}</a>
              {' '}· port {p.port}
              {p.note && <div style={{ marginTop: '0.4rem' }}>{p.note}</div>}
            </div>
          </div>
        ))
      )}
    </>
  );
}
