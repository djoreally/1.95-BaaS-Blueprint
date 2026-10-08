'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HostingMode } from '../lib/hosting';

export default function NewProjectForm({
  domains,
  defaultDomain,
  hostingMode,
}: {
  domains: string[];
  defaultDomain: string;
  hostingMode: HostingMode;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState(defaultDomain);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hosted = hostingMode === 'HOSTED';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain, hostingMode }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Provisioning failed to start');
      router.push(`/projects/${j.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ maxWidth: 560 }}>
      <div className="field">
        <label htmlFor="name">Project name</label>
        <input
          id="name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="acme-crm" required pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?"
          autoComplete="off"
        />
        <div className="hint">
          Lowercase letters, digits, hyphens — becomes <code className="inline">{name || 'name'}.{defaultDomain}</code>
        </div>
      </div>

      {hosted ? (
        <div className="field">
          <label>Hosting</label>
          <div className="hint">
            Fully managed by InvisibleDB. No cPanel or server connection required.
          </div>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="domain">Domain</label>
          <select id="domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {domains.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <div className="hint">From your connected hosting account.</div>
        </div>
      )}

      {error && <div className="check fail"><span className="dot">❌</span><div>{error}</div></div>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Starting…' : 'Create project →'}
      </button>
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        {hosted
          ? 'We allocate the managed subdomain, database, SSL and proxy configuration automatically.'
          : 'This calls the real provisioner: subdomain → MySQL → SSL → proxy rules, with automatic rollback if any step fails.'}
      </p>
    </form>
  );
}
