'use client';

import { useEffect, useState } from 'react';

interface Step {
  id: string;
  label: string;
  state: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  detail?: string;
}

interface Job {
  id: string;
  name: string;
  fqdn: string;
  status: 'provisioning' | 'ready' | 'failed';
  steps: Step[];
  error?: string;
}

const ICON: Record<Step['state'], string> = {
  pending: '⚪',
  running: '🔄',
  done: '✅',
  failed: '❌',
  skipped: '⏭️',
};

export default function ProvisioningFeed({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
        const j = (await res.json()) as Job;
        if (!stop) setJob(j);
        if (j.status === 'provisioning' && !stop) {
          setTimeout(poll, 2000);
        } else if (j.status === 'ready' && !stop) {
          // Let the user see the final green state, then show the dashboard.
          setTimeout(() => { window.location.reload(); }, 2500);
        }
      } catch {
        if (!stop) setTimeout(poll, 4000);
      }
    }
    void poll();
    return () => { stop = true; };
  }, [id]);

  if (!job) return <div className="card"><p>Starting provisioning…</p></div>;

  return (
    <div className="card">
      <h2>
        Provisioning <code className="inline">{job.fqdn}</code>{' '}
        {job.status === 'provisioning' && <span className="badge pending">WORKING</span>}
        {job.status === 'ready' && <span className="badge up">LIVE</span>}
        {job.status === 'failed' && <span className="badge down">FAILED</span>}
      </h2>
      {job.steps.map((s) => (
        <div className="step" key={s.id}>
          <span className="icon">{ICON[s.state]}</span>
          <div>
            <div>{s.label}</div>
            {s.detail && <div className="meta">{s.detail}</div>}
          </div>
        </div>
      ))}
      {job.status === 'failed' && job.error && (
        <div className="callout warn" style={{ borderColor: 'var(--red)', background: 'var(--red-bg)' }}>
          <strong>Provisioning failed.</strong> {job.error} Automatic rollback already ran —
          anything created was torn down. Fix the cause and try again.
        </div>
      )}
      {job.status === 'ready' && (
        <p>✅ Every step green — loading your dashboard…</p>
      )}
    </div>
  );
}
