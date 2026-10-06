import { listProjects } from '@/lib/adapter';

// Dashboard placeholder — lists projects. The MVP grows this page into:
// create-project wizard, per-project env vars, logs, domains, vector toggle.
export default async function Dashboard() {
  const projects = await listProjects();

  return (
    <div>
      <h1>Projects</h1>
      {projects.length === 0 ? (
        <p>
          No projects yet. The create-project wizard lands here — subdomain +
          database + SSL + binary, one click.
        </p>
      ) : (
        <ul>
          {projects.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> —{' '}
              <a href={`https://${p.fqdn}`}>{p.fqdn}</a>{' '}
              <span style={{ color: '#666' }}>:{p.port}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
