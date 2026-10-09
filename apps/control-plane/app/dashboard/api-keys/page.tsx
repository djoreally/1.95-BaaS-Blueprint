'use client';
import { useEffect, useState } from 'react';

type KeyRow = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt?: string | null; revokedAt?: string | null };

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]); const [name, setName] = useState('Claude / ChatGPT'); const [token, setToken] = useState(''); const [error, setError] = useState('');
  const load = async () => { const res = await fetch('/api/api-keys', { cache: 'no-store' }); if (res.ok) setKeys((await res.json()).keys ?? []); };
  useEffect(() => { void load(); }, []);
  const create = async () => { setError(''); setToken(''); const res = await fetch('/api/api-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) }); const body = await res.json(); if (!res.ok) return setError(body.error || 'Could not create key'); setToken(body.token); await load(); };
  const revoke = async (id: string) => { await fetch('/api/api-keys', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); await load(); };
  return <div style={{ maxWidth: 820 }}>
    <div className="kicker">Agent access</div><h1>API keys</h1><p style={{ color: '#9a9a9a' }}>Create a scoped control-plane key for the InvisibleDB MCP. Keys can manage only databases owned by your account.</p>
    <div className="tool-card" style={{ padding: 20 }}><label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>Key name</label><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><input value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, minWidth: 240, padding: 12, background: '#111', color: '#fff', border: '1px solid #333', borderRadius: 8 }} /><button className="btn primary" onClick={create}>Create key</button></div>{error ? <p style={{ color: '#ff6b6b' }}>{error}</p> : null}{token ? <div style={{ marginTop: 16, padding: 14, background: '#151008', border: '1px solid #5c3900', borderRadius: 8 }}><strong>Copy this now — it is shown once.</strong><code style={{ display: 'block', marginTop: 8, wordBreak: 'break-all', color: '#ffb12b' }}>{token}</code></div> : null}</div>
    <h2 style={{ marginTop: 30 }}>Keys</h2>{keys.length === 0 ? <p style={{ color: '#777' }}>No keys yet.</p> : keys.map((key) => <div key={key.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #222' }}><div style={{ flex: 1 }}><strong>{key.name}</strong><div style={{ color: '#777', fontSize: 13 }}>{key.prefix}… · created {new Date(key.createdAt).toLocaleString()}{key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleString()}` : ''}</div></div>{key.revokedAt ? <span className="badge">REVOKED</span> : <button className="btn" onClick={() => revoke(key.id)}>Revoke</button>}</div>)}
    <div style={{ marginTop: 30, color: '#8a8a8a', lineHeight: 1.7 }}><strong style={{ color: '#ddd' }}>MCP environment</strong><pre style={{ whiteSpace: 'pre-wrap' }}>{`INVISIBLED_API_URL=https://www.invisibledb.app\nINVISIBLED_API_KEY=idb_sk_...`}</pre></div>
  </div>;
}
