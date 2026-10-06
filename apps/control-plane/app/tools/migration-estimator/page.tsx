/**
 * InvisibleDB — Migration Estimator.
 *
 * Five questions, one honest migration plan. Estimates are labeled as
 * estimates and deliberately conservative.
 */
'use client';

import { useMemo, useState } from 'react';
import ToolCrossLinks from '../ToolCrossLinks';

type BackendId = 'firebase' | 'supabase' | 'pockethost' | 'custom' | 'none';
type Realtime = 'no' | 'yes' | 'heavy';

const BACKENDS: { id: BackendId; label: string; desc: string }[] = [
  { id: 'firebase', label: 'Firebase', desc: 'Firestore / Realtime DB + Firebase Auth + Cloud Storage' },
  { id: 'supabase', label: 'Supabase', desc: 'Postgres + Supabase Auth + Storage' },
  { id: 'pockethost', label: 'PocketHost', desc: 'Hosted PocketBase — the fastest move, same engine' },
  { id: 'custom', label: 'Custom / self-hosted', desc: 'Your own API, database, and auth stack' },
  { id: 'none', label: 'No backend yet', desc: 'Greenfield project — nothing to migrate' },
];

const REALTIME_OPTIONS: { id: Realtime; label: string; desc: string }[] = [
  { id: 'no', label: 'No', desc: 'Poll or refetch — no live listeners' },
  { id: 'yes', label: 'Yes', desc: 'Live listeners on some collections' },
  { id: 'heavy', label: 'Heavy', desc: 'Realtime is core to the product' },
];

const EXPORT_BASE: Record<Exclude<BackendId, 'none'>, number> = {
  firebase: 4,
  supabase: 3,
  pockethost: 1.5,
  custom: 8,
};

const BACKEND_CAVEATS: Record<BackendId, string[]> = {
  firebase: [
    'Firebase Auth password hashes cannot be exported. Users keep their accounts, but most will reset their password once — plan the email.',
    'Firestore has no schema to export, so the schema map is the slow part: expect denormalized documents that need relational decisions.',
    'Security rules are evaluated per-request; rewrite them as permission policies — they transfer conceptually, not line-for-line.',
  ],
  supabase: [
    'Postgres exports cleanly, but Postgres-only features (RLS policies, triggers, extensions like pgvector) need equivalents in SQLite.',
    'Supabase Auth password hashes are exportable from self-hosted instances; hosted exports vary — check before you promise zero resets.',
  ],
  pockethost: [
    'Both sides run the same engine, so collections, rules, and files map almost one-to-one — this is the easiest migration on the list.',
    'Main work is re-pointing SDK endpoints and moving the SQLite files over.',
  ],
  custom: [
    'The honest unknown: migration speed is bounded by your API, not by the destination. Rate limits and pagination are the real phase.',
    'Lock down a stable export snapshot date before you start — migrating a moving target doubles the work.',
  ],
  none: ['Nothing to migrate. This is the setup plan for a new project.'],
};

const TRANSFERS_AS_IS: { label: string; detail: string }[] = [
  { label: 'Collections → collections', detail: 'Documents go in as JSON and come back out the same shape. No re-modeling required to start.' },
  { label: 'Users → auth accounts', detail: 'Emails, verified flags, and roles carry over. (Password hashes depend on your provider — see the caveats.)' },
  { label: 'Files → storage files', detail: 'Same bytes, same names. Storage moves are measured in bandwidth, not effort.' },
  { label: 'Realtime listeners → realtime channels', detail: 'The event-driven shape is the same — subscribe, get updates, unsubscribe.' },
  { label: 'Vector embeddings → built-in vectors', detail: 'Embeddings import as vectors; semantic search works with no extra service.' },
];

interface Phase {
  name: string;
  desc: string;
  low: number;
  high: number;
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function buildPlan(backend: BackendId, collections: number, users: number, storageGB: number, realtime: Realtime): { phases: Phase[]; totalLow: number; totalHigh: number; workdays: string } {
  const phases: Phase[] = [];

  if (backend === 'none') {
    phases.push(
      { name: '1. Project setup', desc: 'Create the project, define collections, set up auth and storage buckets.', low: 1, high: 3 },
      { name: '2. SDK integration', desc: 'Point your app at the new endpoints and wire up auth.', low: 2, high: 6 },
      { name: '3. Launch check', desc: 'Smoke tests, permissions review, go live.', low: 1, high: 2 },
    );
  } else {
    const exportH = Math.min(8, EXPORT_BASE[backend] + collections * 0.2);
    phases.push({
      name: '1. Export',
      desc: 'Pull a complete snapshot: documents, user accounts, files. Validate row counts before moving on.',
      low: round1(exportH * 0.7), high: round1(exportH * 1.5),
    });

    const schemaH = Math.max(1, collections * 0.6);
    phases.push({
      name: '2. Schema map',
      desc: 'Map each collection to its destination shape. Decide what stays denormalized and what becomes relational.',
      low: round1(schemaH * 0.7), high: round1(schemaH * 1.5),
    });

    let importH = 0.5;
    if (users > 0) importH += Math.max(0.5, users / 20000);
    if (storageGB > 0) importH += storageGB / 10;
    if (realtime === 'heavy') importH *= 1.5;
    phases.push({
      name: '3. Data import',
      desc: 'Load documents, files, and user accounts. Re-run until counts match the export exactly.',
      low: round1(importH * 0.7), high: round1(importH * 1.5),
    });

    if (users > 0) {
      const authH = 1.5 + users / 10000;
      phases.push({
        name: '4. Auth migration',
        desc: 'Move accounts, preserve sessions where possible, send reset emails where hashes cannot travel.',
        low: round1(authH * 0.7), high: round1(authH * 1.5),
      });
    } else {
      phases.push({
        name: '4. Auth migration',
        desc: 'No user accounts to move — skip this phase.',
        low: 0, high: 0,
      });
    }

    const cutoverBase = realtime === 'heavy' ? 6 : 4;
    phases.push({
      name: '5. Cutover',
      desc: 'Freeze writes, run the final delta import, switch endpoints, verify, and keep the old backend read-only for 30 days.',
      low: round1(cutoverBase * 0.7), high: round1(cutoverBase * 1.5),
    });
  }

  const totalLow = phases.reduce((s, p) => s + p.low, 0);
  const totalHigh = phases.reduce((s, p) => s + p.high, 0);
  // Conservative: ~6 focused hours per workday, rounded up.
  const days = Math.max(1, Math.ceil(totalHigh / 6));
  const workdays = days === 1 ? 'about 1 working day' : `about ${days} working days`;
  return { phases, totalLow, totalHigh, workdays };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export default function MigrationEstimatorPage() {
  const [backend, setBackend] = useState<BackendId>('firebase');
  const [collections, setCollections] = useState(12);
  const [users, setUsers] = useState(5000);
  const [storageGB, setStorageGB] = useState(25);
  const [realtime, setRealtime] = useState<Realtime>('yes');
  const [generated, setGenerated] = useState(false);

  const plan = useMemo(
    () => buildPlan(backend, collections, users, storageGB, realtime),
    [backend, collections, users, storageGB, realtime]
  );

  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return (
    <div className="m-page">
      <style>{`
        .tool-hero { text-align: center; padding: 5rem 1.5rem 3.5rem; max-width: 52rem; margin: 0 auto; }
        .tool-card { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 14px; padding: 1.75rem; margin-bottom: 1.25rem; }
        .tool-card h3 { margin: 0 0 0.25rem; }
        .tool-card .q { color: var(--faint); font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem; }
        .pill-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
        .pill { border: 1px solid var(--line); background: var(--bg-softer); color: var(--muted); border-radius: 999px; padding: 0.55rem 1.1rem; font-size: 0.95rem; font-weight: 600; cursor: pointer; font-family: inherit; }
        .pill:hover { border-color: var(--faint); color: var(--ink); }
        .pill.active { border-color: var(--amber); color: var(--amber); background: var(--amber-dim); }
        .pill .sub { display: block; font-size: 0.8rem; font-weight: 400; color: var(--faint); }
        .pill.active .sub { color: var(--amber); opacity: 0.8; }
        .tool-inputs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
        @media (max-width: 640px) { .tool-inputs { grid-template-columns: 1fr; } }
        .tool-number { width: 100%; padding: 0.65rem 0.8rem; border: 1px solid var(--line); border-radius: 8px; font-size: 1.05rem; background: var(--bg-softer); color: var(--ink); font-family: inherit; margin-top: 0.4rem; }
        .tool-number:focus { outline: none; border-color: var(--amber); }
        .phase { display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--line); align-items: flex-start; }
        .phase:last-child { border-bottom: none; }
        .phase .hours { margin-left: auto; white-space: nowrap; font-weight: 800; color: var(--amber); }
        .phase .desc { color: var(--muted); font-size: 0.95rem; margin: 0.25rem 0 0; line-height: 1.6; }
        .transfer li { margin-bottom: 0.6rem; line-height: 1.6; }
        .transfer li strong { color: var(--ink); }
        .caveat li { margin-bottom: 0.6rem; line-height: 1.6; color: var(--muted); }
        .total-band { background: var(--amber-dim); border: 1px solid rgba(245,158,11,0.35); border-radius: 14px; padding: 1.75rem; text-align: center; margin: 1.5rem 0; }
        .total-band .big { font-size: 2.2rem; font-weight: 800; letter-spacing: -0.02em; }
        .total-band .big span { color: var(--amber); }
        .total-band p { color: var(--muted); margin: 0.5rem 0 0; font-size: 0.95rem; }
        .fine { font-size: 0.85rem; color: var(--faint); }
      `}</style>

      {/* HERO */}
      <section className="tool-hero">
        <span className="kicker">Tools · Migration Estimator</span>
        <h1>
          Leaving your backend? <span className="hl">Get the plan.</span>
        </h1>
        <p className="lede" style={{ margin: '0 auto' }}>
          Answer five questions and get a phase-by-phase migration plan with honest time
          estimates. No sales call, no "talk to our team" — just the work, sized.
        </p>
      </section>

      <div className="m-wrap" style={{ maxWidth: '56rem', paddingBottom: '5rem' }}>
        {/* Q1 */}
        <div className="tool-card">
          <div className="q">Question 1 of 5</div>
          <h2 className="h3">What are you migrating from?</h2>
          <div className="pill-row" style={{ marginTop: '1rem' }}>
            {BACKENDS.map((b) => (
              <button
                key={b.id}
                className={`pill${backend === b.id ? ' active' : ''}`}
                onClick={() => setBackend(b.id)}
                aria-pressed={backend === b.id}
              >
                {b.label}
                <span className="sub">{b.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Q2–Q4 */}
        <div className="tool-card">
          <div className="q">Questions 2–4 of 5</div>
          <h2 className="h3">How big is it?</h2>
          <div className="tool-inputs" style={{ marginTop: '1rem' }}>
            <div>
              <label htmlFor="collections" style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                Collections / tables
              </label>
              <input
                id="collections"
                className="tool-number"
                type="number"
                min={0}
                value={collections}
                onChange={(e) => setCollections(num(e.target.value, 0))}
              />
            </div>
            <div>
              <label htmlFor="users" style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                Auth users
              </label>
              <input
                id="users"
                className="tool-number"
                type="number"
                min={0}
                value={users}
                onChange={(e) => setUsers(num(e.target.value, 0))}
              />
            </div>
            <div>
              <label htmlFor="storage" style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                Storage (GB)
              </label>
              <input
                id="storage"
                className="tool-number"
                type="number"
                min={0}
                value={storageGB}
                onChange={(e) => setStorageGB(num(e.target.value, 0))}
              />
            </div>
          </div>
        </div>

        {/* Q5 */}
        <div className="tool-card">
          <div className="q">Question 5 of 5</div>
          <h2 className="h3">Do you use realtime features?</h2>
          <div className="pill-row" style={{ marginTop: '1rem' }}>
            {REALTIME_OPTIONS.map((r) => (
              <button
                key={r.id}
                className={`pill${realtime === r.id ? ' active' : ''}`}
                onClick={() => setRealtime(r.id)}
                aria-pressed={realtime === r.id}
              >
                {r.label}
                <span className="sub">{r.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', margin: '1.5rem 0 2.5rem' }}>
          <button className="m-btn" onClick={() => setGenerated(true)}>
            Generate my migration plan
          </button>
        </div>

        {generated && (
          <>
            {/* TOTAL */}
            <div className="total-band">
              <div className="big">
                {fmtHours(plan.totalLow)} – {fmtHours(plan.totalHigh)} <span>estimated</span>
              </div>
              <p>
                Roughly {plan.workdays} of focused work. These are estimates, not quotes —
                every codebase has a surprise hiding in it.
              </p>
            </div>

            {/* PHASES */}
            <div className="tool-card">
              <h2 className="h3">Your migration plan</h2>
              <div style={{ marginTop: '1rem' }}>
                {plan.phases.map((p) => (
                  <div className="phase" key={p.name}>
                    <div>
                      <strong>{p.name}</strong>
                      <p className="desc">{p.desc}</p>
                    </div>
                    <div className="hours">{p.low === 0 && p.high === 0 ? 'skip' : `${fmtHours(p.low)}–${fmtHours(p.high)}`}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* TRANSFERS AS-IS */}
            <div className="tool-card">
              <h2 className="h3">What transfers as-is</h2>
              <ul className="transfer" style={{ paddingLeft: '1.2rem', marginTop: '1rem' }}>
                {TRANSFERS_AS_IS.map((t) => (
                  <li key={t.label}>
                    <strong>{t.label}.</strong> <span style={{ color: 'var(--muted)' }}>{t.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CAVEATS */}
            <div className="tool-card">
              <h2 className="h3">Honest caveats for {BACKENDS.find((b) => b.id === backend)?.label}</h2>
              <ul className="caveat" style={{ paddingLeft: '1.2rem', marginTop: '1rem' }}>
                {BACKEND_CAVEATS[backend].map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>

            <p className="fine" style={{ textAlign: 'center', marginTop: '2rem' }}>
              Estimates assume one developer who knows the codebase, working with the
              export tools your provider offers. They exclude rewriting business logic
              that lives in cloud functions or triggers.
            </p>

            <ToolCrossLinks current="/tools/migration-estimator" />

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <a className="m-btn" href="/signup">
                Start migrating — first month $1
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
