'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type JsonObject = Record<string, unknown>;
type RuntimeCommand = {
  id: string;
  kind: string;
  status: string;
  result?: unknown;
  hasSecret?: boolean;
  createdAt?: string;
};
type RuntimeResponse = {
  state: { snapshot: JsonObject; observedAt: string } | null;
  managementReady: boolean;
  commands: RuntimeCommand[];
  refreshQueued?: boolean;
};

function obj(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function formatBytes(value: unknown) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

async function jsonFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((data as JsonObject).error || `Request failed (${response.status})`));
  return data;
}

export default function DatabaseSectionClient({ slug, section, endpoint }: { slug: string; section: string; endpoint: string }) {
  const [runtime, setRuntime] = useState<RuntimeResponse | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const runtimeUrl = `/api/projects/${encodeURIComponent(slug)}/runtime`;
  const dataUrl = `/api/projects/${encodeURIComponent(slug)}/data`;

  const loadRuntime = useCallback(async () => {
    try {
      const data = await jsonFetch(runtimeUrl) as RuntimeResponse;
      setRuntime(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Runtime status failed');
    }
  }, [runtimeUrl]);

  useEffect(() => {
    void loadRuntime();
    const timer = window.setInterval(() => void loadRuntime(), 10_000);
    return () => window.clearInterval(timer);
  }, [loadRuntime]);

  const command = useCallback(async (kind: string, payload?: JsonObject) => {
    setNotice('Queuing command…');
    setError('');
    try {
      const data = await jsonFetch(runtimeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      }) as JsonObject;
      setNotice(`${kind.replace('_', ' ')} queued (${String(data.status || 'pending')}).`);
      await loadRuntime();
      return String(data.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Command failed');
      return '';
    }
  }, [runtimeUrl, loadRuntime]);

  const snapshot = runtime?.state?.snapshot ?? {};
  const latest = (kind: string) => runtime?.commands.find((item) => item.kind === kind);

  return (
    <>
      {error ? <div className="card" style={{ borderColor: '#7d2b2b', marginBottom: 14, color: '#ffb0b0' }}>{error}</div> : null}
      {notice ? <div style={{ color: '#9d9d9d', fontSize: 13, marginBottom: 12 }}>{notice}</div> : null}
      {!runtime?.managementReady && ['auth', 'database', 'storage', 'vector'].includes(section) ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <strong>Securing management connection…</strong>
          <p style={{ color: '#999', marginBottom: 0 }}>This existing instance is synchronizing its encrypted control-plane credential. The key never goes to browser JavaScript.</p>
        </div>
      ) : null}

      {section === 'overview' ? <Overview snapshot={snapshot} endpoint={endpoint} refresh={() => command('status')} /> : null}
      {section === 'connect' ? <Connect endpoint={endpoint} slug={slug} runtime={runtime} onRotate={() => command('rotate_key')} /> : null}
      {section === 'auth' ? <AuthPanel dataUrl={dataUrl} managementReady={Boolean(runtime?.managementReady)} /> : null}
      {section === 'database' ? <DatabasePanel dataUrl={dataUrl} managementReady={Boolean(runtime?.managementReady)} /> : null}
      {section === 'storage' ? <StoragePanel dataUrl={dataUrl} snapshot={snapshot} managementReady={Boolean(runtime?.managementReady)} /> : null}
      {section === 'vector' ? <VectorPanel dataUrl={dataUrl} snapshot={snapshot} managementReady={Boolean(runtime?.managementReady)} /> : null}
      {section === 'realtime' ? <RealtimePanel dataUrl={dataUrl} snapshot={snapshot} /> : null}
      {section === 'backups' ? <BackupsPanel snapshot={snapshot} onBackup={() => command('backup')} onRestore={(backup) => command('restore', { backup })} /> : null}
      {section === 'logs' ? <LogsPanel latest={latest('logs')} load={() => command('logs', { lines: 250 })} /> : null}
      {section === 'settings' ? <SettingsPanel runtime={runtime} onRestart={() => command('restart')} onRotate={() => command('rotate_key')} slug={slug} /> : null}
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card" style={{ marginBottom: 14 }}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ border: '1px solid #292929', background: '#101010', borderRadius: 10, padding: 14 }}><div style={{ color: '#777', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div><div style={{ marginTop: 5, fontWeight: 800 }}>{value}</div></div>;
}

function Overview({ snapshot, endpoint, refresh }: { snapshot: JsonObject; endpoint: string; refresh: () => void }) {
  const container = obj(snapshot.container);
  const usage = obj(snapshot.usage);
  const tls = obj(snapshot.tls);
  return <>
    <Panel title="Runtime">
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Metric label="Container" value={String(container.status || 'Waiting for telemetry')} />
        <Metric label="Gateway" value={snapshot.gatewayHealthy === true ? 'Healthy' : snapshot.gatewayHealthy === false ? 'Down' : 'Unknown'} />
        <Metric label="TLS" value={tls.healthy === true ? `Healthy (${String(tls.httpStatus || '')})` : 'Unknown'} />
        <Metric label="Memory" value={String(container.memory || '—')} />
        <Metric label="CPU" value={String(container.cpuPercent || '—')} />
        <Metric label="Last backup" value={snapshot.lastBackupAt ? new Date(String(snapshot.lastBackupAt)).toLocaleString() : 'None reported'} />
      </div>
      <button className="btn" onClick={refresh} style={{ marginTop: 16 }}>Refresh runtime</button>
    </Panel>
    <Panel title="Usage">
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <Metric label="Database" value={formatBytes(usage.databaseBytes)} />
        <Metric label="Files / other" value={formatBytes(usage.storageBytes)} />
        <Metric label="Volume total" value={formatBytes(usage.volumeBytes)} />
      </div>
    </Panel>
    <Panel title="API endpoint"><code style={{ color: '#ffad1f', overflowWrap: 'anywhere' }}>{endpoint}</code><p style={{ color: '#888', marginBottom: 0 }}>Protected application backend endpoint. The dashboard manages it through server-side credentials.</p></Panel>
  </>;
}

function Connect({ endpoint, slug, runtime, onRotate }: { endpoint: string; slug: string; runtime: RuntimeResponse | null; onRotate: () => void }) {
  const rotated = runtime?.commands.find((item) => item.kind === 'rotate_key' && item.status === 'done' && item.hasSecret);
  const [secret, setSecret] = useState('');
  async function reveal() {
    if (!rotated) return;
    const data = await jsonFetch(`/api/projects/${encodeURIComponent(slug)}/runtime/${rotated.id}/secret`) as JsonObject;
    setSecret(String(data.secret || ''));
  }
  return <>
    <Panel title="Connect your application">
      <p style={{ color: '#aaa' }}>Endpoint</p><code style={{ color: '#ffad1f' }}>{endpoint}</code>
      <pre style={{ overflowX: 'auto', padding: 14, borderRadius: 10, background: '#0b0b0b', border: '1px solid #222', marginTop: 16 }}>{`import { InvisibleDB } from 'invisibledb';\n\nconst db = new InvisibleDB({\n  baseUrl: '${endpoint}',\n  apiKey: process.env.INVISIBLEDB_KEY,\n});`}</pre>
      <a href="/dashboard/docs" style={{ color: '#ff9f00' }}>SDK documentation →</a>
    </Panel>
    <Panel title="API key">
      <p style={{ color: '#aaa' }}>Rotate the server key if it has been exposed. Rotation invalidates the old key immediately.</p>
      <button className="btn" onClick={onRotate}>Rotate API key</button>
      {rotated ? <button onClick={() => void reveal()} style={{ marginLeft: 10, padding: '10px 14px' }}>Reveal new key once</button> : null}
      {secret ? <pre style={{ marginTop: 12, overflowX: 'auto' }}>{secret}</pre> : null}
    </Panel>
  </>;
}

function useCollections(dataUrl: string, enabled: boolean) {
  const [collections, setCollections] = useState<JsonObject[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = obj(await jsonFetch(`${dataUrl}?resource=collections`));
      setCollections(arr(data.items).map(obj));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load collections'); }
  }, [dataUrl, enabled]);
  useEffect(() => { void load(); }, [load]);
  return { collections, load, error };
}

function DatabasePanel({ dataUrl, managementReady }: { dataUrl: string; managementReady: boolean }) {
  const { collections, load: loadCollections, error } = useCollections(dataUrl, managementReady);
  const [selected, setSelected] = useState('');
  const [records, setRecords] = useState<JsonObject[]>([]);
  const [recordJson, setRecordJson] = useState('{}');
  const [editing, setEditing] = useState('');
  const [collectionJson, setCollectionJson] = useState('{\n  "name": "messages",\n  "type": "base",\n  "fields": []\n}');
  const [message, setMessage] = useState(error);

  useEffect(() => { if (!selected && collections[0]?.name) setSelected(String(collections[0].name)); }, [collections, selected]);
  const loadRecords = useCallback(async () => {
    if (!selected) return;
    try { const data = obj(await jsonFetch(`${dataUrl}?resource=records&collection=${encodeURIComponent(selected)}&perPage=100`)); setRecords(arr(data.items).map(obj)); setMessage(''); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Failed to load records'); }
  }, [dataUrl, selected]);
  useEffect(() => { void loadRecords(); }, [loadRecords]);

  async function saveRecord() {
    try {
      const data = JSON.parse(recordJson) as JsonObject;
      await jsonFetch(dataUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: editing ? 'record.update' : 'record.create', collection: selected, id: editing || undefined, data }) });
      setEditing(''); setRecordJson('{}'); await loadRecords();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Save failed'); }
  }
  async function deleteRecord(id: string) {
    if (!confirm(`Delete record ${id}?`)) return;
    await jsonFetch(dataUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'record.delete', collection: selected, id }) });
    await loadRecords();
  }
  async function createCollection() {
    try { await jsonFetch(dataUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'collection.create', data: JSON.parse(collectionJson) }) }); await loadCollections(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Collection create failed'); }
  }

  return <>
    <Panel title="Collections">
      {message || error ? <p style={{ color: '#ffb0b0' }}>{message || error}</p> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{collections.map((c) => <button key={String(c.id || c.name)} onClick={() => setSelected(String(c.name || c.id))} style={{ padding: '8px 12px', borderRadius: 8, border: selected === String(c.name || c.id) ? '1px solid #ff9f00' : '1px solid #333', background: '#111', color: '#ddd' }}>{String(c.name || c.id)}</button>)}</div>
      <details style={{ marginTop: 16 }}><summary>Create collection</summary><textarea value={collectionJson} onChange={(e) => setCollectionJson(e.target.value)} rows={7} style={{ width: '100%', marginTop: 10 }} /><button className="btn" onClick={() => void createCollection()}>Create</button></details>
    </Panel>
    <Panel title={selected ? `${selected} records` : 'Records'}>
      {!selected ? <p style={{ color: '#888' }}>Select or create a collection.</p> : null}
      {records.map((record) => <div key={String(record.id)} style={{ borderBottom: '1px solid #222', padding: '10px 0' }}><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(record, null, 2)}</pre><button onClick={() => { setEditing(String(record.id)); setRecordJson(JSON.stringify(record, null, 2)); }}>Edit</button><button onClick={() => void deleteRecord(String(record.id))} style={{ marginLeft: 8 }}>Delete</button></div>)}
      {selected ? <div style={{ marginTop: 16 }}><h3>{editing ? `Edit ${editing}` : 'Create record'}</h3><textarea value={recordJson} onChange={(e) => setRecordJson(e.target.value)} rows={8} style={{ width: '100%' }} /><button className="btn" onClick={() => void saveRecord()}>Save record</button>{editing ? <button onClick={() => { setEditing(''); setRecordJson('{}'); }} style={{ marginLeft: 8 }}>Cancel</button> : null}</div> : null}
    </Panel>
  </>;
}

function AuthPanel({ dataUrl, managementReady }: { dataUrl: string; managementReady: boolean }) {
  const [collections, setCollections] = useState<JsonObject[]>([]);
  const [selected, setSelected] = useState('');
  const [users, setUsers] = useState<JsonObject[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!managementReady) return;
    try {
      const suffix = selected ? `&collection=${encodeURIComponent(selected)}` : '';
      const data = obj(await jsonFetch(`${dataUrl}?resource=auth${suffix}`));
      const cs = arr(data.collections).map(obj); setCollections(cs);
      if (!selected && cs[0]) setSelected(String(cs[0].name || cs[0].id));
      const records = obj(data.records); setUsers(arr(records.items).map(obj)); setMessage('');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Auth load failed'); }
  }, [dataUrl, managementReady, selected]);
  useEffect(() => { void load(); }, [load]);

  async function createUser() {
    if (!selected) return;
    try {
      await jsonFetch(dataUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'auth.create', collection: selected, data: { email, password, passwordConfirm: password } }) });
      setEmail(''); setPassword(''); await load();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'User create failed'); }
  }
  async function deleteUser(id: string) {
    if (!confirm('Delete this application user?')) return;
    await jsonFetch(dataUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'auth.delete', collection: selected, id }) });
    await load();
  }

  return <Panel title="Application users">
    {message ? <p style={{ color: '#ffb0b0' }}>{message}</p> : null}
    {collections.length ? <select value={selected} onChange={(e) => setSelected(e.target.value)}>{collections.map((c) => <option key={String(c.id)} value={String(c.name || c.id)}>{String(c.name || c.id)}</option>)}</select> : <p style={{ color: '#888' }}>No auth collection exists yet. Create an auth collection from Database → Collections.</p>}
    {users.map((user) => <div key={String(user.id)} style={{ padding: '10px 0', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>{String(user.email || user.username || user.id)}</span><button onClick={() => void deleteUser(String(user.id))}>Delete</button></div>)}
    {selected ? <div style={{ display: 'grid', gap: 8, marginTop: 16, maxWidth: 460 }}><input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><button className="btn" onClick={() => void createUser()}>Create user</button></div> : null}
  </Panel>;
}

function StoragePanel({ dataUrl, snapshot, managementReady }: { dataUrl: string; snapshot: JsonObject; managementReady: boolean }) {
  const { collections, error } = useCollections(dataUrl, managementReady);
  const usage = obj(snapshot.usage);
  const fileFields = collections.flatMap((collection) => arr(collection.fields).map(obj).filter((field) => field.type === 'file').map((field) => ({ collection: String(collection.name || collection.id), field: String(field.name || field.id) })));
  return <>
    <Panel title="Storage usage"><div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}><Metric label="Files / other" value={formatBytes(usage.storageBytes)} /><Metric label="Total volume" value={formatBytes(usage.volumeBytes)} /></div></Panel>
    <Panel title="File fields">{error ? <p style={{ color: '#ffb0b0' }}>{error}</p> : null}{fileFields.length ? fileFields.map((item) => <div key={`${item.collection}:${item.field}`} style={{ padding: '8px 0', borderBottom: '1px solid #222' }}><strong>{item.collection}</strong> · {item.field}</div>) : <p style={{ color: '#888' }}>No file fields found in the current collection schemas.</p>}</Panel>
  </>;
}

function VectorPanel({ dataUrl, snapshot, managementReady }: { dataUrl: string; snapshot: JsonObject; managementReady: boolean }) {
  const features = obj(snapshot.features);
  const [collection, setCollection] = useState('');
  const [embedding, setEmbedding] = useState('');
  const [result, setResult] = useState('');
  async function query() {
    try {
      const vector = JSON.parse(embedding) as number[];
      const data = await jsonFetch(dataUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'vector.query', collection, embedding: vector, limit: 10 }) });
      setResult(JSON.stringify(data, null, 2));
    } catch (e) { setResult(e instanceof Error ? e.message : 'Vector query failed'); }
  }
  return <Panel title="Vector search">
    <p style={{ color: '#aaa' }}>Runtime: <strong>{features.vector === true ? 'sqlite-vec enabled' : features.vector === false ? 'not enabled on this image' : 'waiting for telemetry'}</strong></p>
    <div style={{ display: 'grid', gap: 8, maxWidth: 700 }}><input placeholder="Collection" value={collection} onChange={(e) => setCollection(e.target.value)} /><textarea placeholder="Embedding JSON, e.g. [0.12, 0.9, ...]" rows={5} value={embedding} onChange={(e) => setEmbedding(e.target.value)} /><button className="btn" disabled={!managementReady} onClick={() => void query()}>Run similarity query</button></div>{result ? <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 14 }}>{result}</pre> : null}
  </Panel>;
}

function RealtimePanel({ dataUrl, snapshot }: { dataUrl: string; snapshot: JsonObject }) {
  const features = obj(snapshot.features);
  const [health, setHealth] = useState('Not tested');
  async function test() { try { const data = await jsonFetch(`${dataUrl}?resource=health`); setHealth(`Healthy: ${JSON.stringify(data)}`); } catch (e) { setHealth(e instanceof Error ? e.message : 'Failed'); } }
  return <Panel title="Realtime"><p style={{ color: '#aaa' }}>Realtime support: <strong>{features.realtime === true ? 'Enabled' : 'Waiting for telemetry'}</strong></p><p style={{ color: '#888' }}>{health}</p><button className="btn" onClick={() => void test()}>Test instance connection</button></Panel>;
}

function BackupsPanel({ snapshot, onBackup, onRestore }: { snapshot: JsonObject; onBackup: () => void; onRestore: (backup: string) => void }) {
  const backups = arr(snapshot.backups).map(obj);
  return <Panel title="Backups"><button className="btn" onClick={onBackup}>Backup now</button><p style={{ color: '#888' }}>Restore always creates a safety backup first and validates SQLite integrity before replacement.</p>{backups.map((backup) => <div key={String(backup.filename)} style={{ padding: '10px 0', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div><strong>{String(backup.filename)}</strong><div style={{ color: '#777', fontSize: 12 }}>{formatBytes(backup.bytes)} · {backup.createdAt ? new Date(String(backup.createdAt)).toLocaleString() : ''}</div></div><button onClick={() => { if (confirm(`Restore ${String(backup.filename)}? A safety backup will be taken first.`)) onRestore(String(backup.filename)); }}>Restore</button></div>)}</Panel>;
}

function LogsPanel({ latest, load }: { latest?: RuntimeCommand; load: () => void }) {
  const result = obj(latest?.result); const text = String(result.text || '');
  return <Panel title="Runtime logs"><button className="btn" onClick={load}>Load latest 250 lines</button><p style={{ color: '#888' }}>Logs are fetched on demand and are not retained indefinitely by the control plane.</p>{text ? <pre style={{ maxHeight: 600, overflow: 'auto', whiteSpace: 'pre-wrap', background: '#050505', padding: 14, borderRadius: 8 }}>{text}</pre> : <p style={{ color: '#777' }}>{latest ? `Command ${latest.status}` : 'No log request yet.'}</p>}</Panel>;
}

function SettingsPanel({ runtime, onRestart, onRotate, slug }: { runtime: RuntimeResponse | null; onRestart: () => void; onRotate: () => void; slug: string }) {
  const rotated = runtime?.commands.find((item) => item.kind === 'rotate_key' && item.status === 'done' && item.hasSecret);
  const [secret, setSecret] = useState('');
  async function reveal() { if (!rotated) return; const data = obj(await jsonFetch(`/api/projects/${encodeURIComponent(slug)}/runtime/${rotated.id}/secret`)); setSecret(String(data.secret || '')); }
  return <>
    <Panel title="Instance operations"><button className="btn" onClick={onRestart}>Restart instance</button><button onClick={onRotate} style={{ marginLeft: 10, padding: '10px 14px' }}>Rotate API key</button>{rotated ? <button onClick={() => void reveal()} style={{ marginLeft: 10, padding: '10px 14px' }}>Reveal new key once</button> : null}{secret ? <pre style={{ marginTop: 12 }}>{secret}</pre> : null}</Panel>
    <Panel title="Billing"><a className="btn" href="/dashboard/billing">Billing settings</a></Panel>
  </>;
}
