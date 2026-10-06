'use client';

import { useState } from 'react';

export function RevealSecret({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <code className="inline">{shown ? value : '••••••••••••'}</code>
      <button className="btn secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem' }} onClick={() => setShown((s) => !s)}>
        {shown ? 'Hide' : `Show ${label}`}
      </button>
      {shown && (
        <button
          className="btn secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.85rem' }}
          onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
    </div>
  );
}

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function destroy() {
    if (!window.confirm(`Delete project "${name}"? This tears down the subdomain, database and proxy rules. This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Delete failed');
      window.location.href = '/projects';
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn danger" onClick={destroy} disabled={busy}>
        {busy ? 'Tearing down…' : `Delete project "${name}"`}
      </button>
      {error && <p style={{ color: 'var(--red)' }}>{error}</p>}
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
        Runs the real teardown: subdomain, MySQL database + user, and proxy rules are removed in
        reverse order. Best-effort — anything left behind is reported, never hidden.
      </p>
    </div>
  );
}
