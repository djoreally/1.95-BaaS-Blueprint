'use client';

import { useState } from 'react';

interface Check {
  id: string;
  label: string;
  state: 'pass' | 'fail' | 'warn';
  detail: string;
}

const DOT: Record<Check['state'], string> = { pass: '✅', fail: '❌', warn: '⚠️' };

export default function ConnectForm() {
  const [host, setHost] = useState('');
  const [user, setUser] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setChecks(null);
    setError(null);
    setOk(false);
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, user, apiToken }),
      });
      const j = await res.json();
      setChecks(j.checks ?? []);
      setOk(!!j.ok);
      if (!j.ok && !j.checks) setError(j.error ?? 'Preflight failed');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <form onSubmit={run} className="card">
        <div className="field">
          <label htmlFor="host">cPanel host</label>
          <input
            id="host" value={host} onChange={(e) => setHost(e.target.value)}
            placeholder="server306.orangehost.com" required autoComplete="off"
          />
          <div className="hint">Just the hostname — no https://, no port.</div>
        </div>
        <div className="field">
          <label htmlFor="user">cPanel username</label>
          <input id="user" value={user} onChange={(e) => setUser(e.target.value)} required autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="token">API token</label>
          <input
            id="token" type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)}
            required autoComplete="off"
          />
          <div className="hint">
            cPanel → Security → Manage API Tokens. <strong>Never your password</strong> — tokens can be
            revoked any time and never leave this server.
          </div>
        </div>
        <button className="btn" type="submit" disabled={running}>
          {running ? 'Running preflight…' : 'Connect & run preflight'}
        </button>
      </form>

      {error && <div className="check fail"><span className="dot">❌</span><div>{error}</div></div>}

      {checks && (
        <div className="card">
          <h2>Preflight checklist</h2>
          {checks.map((c) => (
            <div key={c.id} className={`check ${c.state}`}>
              <span className="dot">{DOT[c.state]}</span>
              <div>
                <strong>{c.label}</strong>
                <div className="detail">{c.detail}</div>
              </div>
            </div>
          ))}
          {ok && (
            <p>
              <span className="badge up">CONNECTED</span>{' '}
              <a className="btn" href="/projects/new" style={{ marginLeft: '0.5rem' }}>
                Create your first project →
              </a>
            </p>
          )}
        </div>
      )}
    </>
  );
}
