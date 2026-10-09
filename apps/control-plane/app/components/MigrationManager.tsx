'use client';

import { useEffect, useState } from 'react';

type Plan = { compatibility?: number; collections?: unknown[]; warnings?: string[]; blockers?: string[]; hardBlockers?: string[] };
type Job = { id: string; status: string; sourceProvider: string; createdAt: string; plan?: Plan; verification?: unknown; progress?: Record<string, unknown>; error?: string | null };

export default function MigrationManager({ slug }: { slug: string }) {
  const [manifest, setManifest] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const endpoint = `/api/projects/${encodeURIComponent(slug)}/migrations`;

  const load = async () => {
    const res = await fetch(endpoint, { cache: 'no-store' });
    if (res.ok) setJobs(await res.json());
  };
  useEffect(() => { void load(); }, [slug]);

  const post = async (body: Record<string, unknown>) => {
    setError('');
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Migration request failed');
    return data;
  };

  const analyze = async () => {
    try { setBusy('plan'); setPlan(await post({ action: 'plan', manifest: JSON.parse(manifest) })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };
  const create = async () => {
    try { setBusy('create'); await post({ action: 'create', manifest: JSON.parse(manifest) }); await load(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };
  const action = async (name: string, migrationId: string, extra: Record<string, unknown> = {}) => {
    try {
      setBusy(`${name}:${migrationId}`);
      const data = await post({ action: name, migrationId, ...extra });
      setResult(data);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(''); }
  };
  const rollback = async (migrationId: string) => {
    if (!window.confirm('Restore the pre-migration InvisibleDB snapshot? This replaces the current destination database state.')) return;
    await action('rollback', migrationId);
  };

  return (
    <div>
      <div style={{ padding: 18, border: '1px solid #292929', borderRadius: 12, background: '#0f0f0f' }}>
        <h2 style={{ marginTop: 0 }}>AI migration manifest</h2>
        <p style={{ color: '#888', lineHeight: 1.65 }}>
          For Lovable: connect the Lovable MCP and InvisibleDB MCP to the same agent, call <code>idb_migration_manifest_spec</code>, run its exact-count discovery, then let the agent build MigrationManifest v1.0. You can also paste the manifest here.
        </p>
        <textarea value={manifest} onChange={(e) => setManifest(e.target.value)} placeholder='{"version":"1.0","source":{"provider":"lovable-cloud","engine":"postgres","capturedAt":"..."},"tables":[]}' style={{ width: '100%', minHeight: 210, padding: 12, fontFamily: 'monospace', background: '#080808', color: '#eee', border: '1px solid #333', borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn" disabled={!manifest || !!busy} onClick={analyze}>{busy === 'plan' ? 'Analyzing…' : 'Analyze'}</button>
          <button className="btn primary" disabled={!manifest || !!busy} onClick={create}>{busy === 'create' ? 'Creating…' : 'Create migration'}</button>
          <button className="btn" disabled={!!busy} onClick={() => void load()}>Refresh jobs</button>
        </div>
        {error ? <p style={{ color: '#ff6b6b' }}>{error}</p> : null}
      </div>

      {plan ? (
        <div style={{ marginTop: 18, padding: 18, border: '1px solid #333', borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Compatibility {plan.compatibility}%</h3>
          <p><strong>{plan.collections?.length ?? 0}</strong> collections · <strong>{plan.warnings?.length ?? 0}</strong> warnings · <strong>{plan.blockers?.length ?? 0}</strong> cutover blockers</p>
          {plan.hardBlockers?.length ? <p style={{ color: '#ff6b6b' }}><strong>{plan.hardBlockers.length} hard blocker(s)</strong> prevent staging. Correct the source manifest rather than overriding them.</p> : null}
          {plan.blockers?.length ? <div><strong style={{ color: '#ff8a65' }}>Must resolve before cutover</strong><ul>{plan.blockers.map((item) => <li key={item}>{item}</li>)}</ul></div> : <p style={{ color: '#65d38e' }}>No cutover blockers detected.</p>}
          {plan.warnings?.length ? <details><summary>Warnings</summary><ul>{plan.warnings.map((item) => <li key={item}>{item}</li>)}</ul></details> : null}
        </div>
      ) : null}

      <h2 style={{ marginTop: 32 }}>Migration jobs</h2>
      {jobs.length === 0 ? <p style={{ color: '#777' }}>No migrations yet.</p> : jobs.map((job) => {
        const hard = new Set(job.plan?.hardBlockers ?? []);
        return (
          <div key={job.id} style={{ padding: 16, border: '1px solid #252525', borderRadius: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{job.sourceProvider}</strong><span className="badge">{job.status.toUpperCase()}</span><code style={{ color: '#777' }}>{job.id}</code>
            </div>
            {job.error ? <p style={{ color: '#ff6b6b' }}>{job.error}</p> : null}
            {job.plan?.blockers?.length ? (
              <div style={{ marginTop: 12 }}>
                <strong>Open blockers</strong>
                {job.plan.blockers.map((blocker) => (
                  <div key={blocker} style={{ marginTop: 10, padding: 10, border: '1px solid #292929', borderRadius: 8 }}>
                    <div style={{ color: hard.has(blocker) ? '#ff6b6b' : '#ddd' }}>{blocker}</div>
                    {hard.has(blocker) ? <small style={{ color: '#888' }}>Hard blocker — update the manifest and create a new migration.</small> : (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <input value={evidence[`${job.id}:${blocker}`] ?? ''} onChange={(e) => setEvidence((current) => ({ ...current, [`${job.id}:${blocker}`]: e.target.value }))} placeholder="Evidence: commit SHA, file, test, or verification reference" style={{ flex: 1, minWidth: 260, padding: 9, background: '#0a0a0a', color: '#eee', border: '1px solid #333', borderRadius: 7 }} />
                        <button className="btn" disabled={!!busy || !(evidence[`${job.id}:${blocker}`] ?? '').trim()} onClick={() => action('resolve', job.id, { blocker, evidence: evidence[`${job.id}:${blocker}`] })}>Resolve with evidence</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
            {job.verification ? <pre style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 12, overflowX: 'auto' }}>{JSON.stringify(job.verification, null, 2)}</pre> : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {job.status === 'planned' || job.status === 'failed' ? <button className="btn" disabled={!!busy || Boolean(job.plan?.hardBlockers?.length)} onClick={() => action('start', job.id)}>Snapshot & start</button> : null}
              {job.status === 'snapshotting' ? <button className="btn" disabled={!!busy} onClick={() => action('prepare', job.id)}>Prepare schema</button> : null}
              {['schema_ready','importing','staged'].includes(job.status) ? <button className="btn" disabled={!!busy} onClick={() => action('verify', job.id)}>Verify</button> : null}
              {job.status === 'verified' ? <button className="btn primary" disabled={!!busy} onClick={() => action('cutover', job.id)}>Generate safe cutover</button> : null}
              {['schema_ready','importing','staged','verified','cutover','failed'].includes(job.status) && job.progress?.preMigrationBackup ? <button className="btn" disabled={!!busy} onClick={() => rollback(job.id)}>Rollback snapshot</button> : null}
            </div>
          </div>
        );
      })}

      {result ? <details style={{ marginTop: 20 }} open><summary>Last migration result</summary><pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto', color: '#aaa', fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre></details> : null}
    </div>
  );
}
