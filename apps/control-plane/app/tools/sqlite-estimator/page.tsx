/**
 * InvisibleDB — SQLite Size Estimator.
 *
 * Show developers how small their database actually is. Ends with the payoff line.
 */
'use client';

import { useMemo, useState } from 'react';
import ToolCrossLinks from '../ToolCrossLinks';

interface Preset {
  id: string;
  label: string;
  bytesPerRow: number;
  note: string;
}

const PRESETS: Preset[] = [
  { id: 'users', label: 'Users', bytesPerRow: 400, note: 'email, name, role, timestamps' },
  { id: 'documents', label: 'Documents', bytesPerRow: 2048, note: 'a typical JSON document' },
  { id: 'messages', label: 'Messages', bytesPerRow: 1024, note: 'chat / notification payload' },
  { id: 'events', label: 'Events / logs', bytesPerRow: 200, note: 'small structured event rows' },
  { id: 'vectors768', label: 'Embeddings (768-dim)', bytesPerRow: 3140, note: '768 × 4-byte floats + row overhead' },
  { id: 'custom', label: 'Custom', bytesPerRow: 512, note: 'set your own bytes per row' },
];

interface Row {
  id: number;
  name: string;
  preset: string;
  rows: number;
  bytesPerRow: number;
}

let nextId = 1;
function makeRow(): Row {
  return { id: nextId++, name: 'users', preset: 'users', rows: 10000, bytesPerRow: 400 };
}

const PAGE_OVERHEAD = 0.15; // SQLite page slack, freelists, headers — rule of thumb
const INDEX_OVERHEAD = 0.25; // per indexed column set, very rough

function fmtBytes(b: number): string {
  if (b < 1024) return `${Math.round(b)} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

export default function SqliteEstimatorPage() {
  const [rows, setRows] = useState<Row[]>([makeRow()]);

  const calc = useMemo(() => {
    const lines = rows.map((r) => ({
      ...r,
      payload: r.rows * r.bytesPerRow,
    }));
    const payloadTotal = lines.reduce((s, l) => s + l.payload, 0);
    const pageOverhead = payloadTotal * PAGE_OVERHEAD;
    const indexOverhead = payloadTotal * INDEX_OVERHEAD;
    const total = payloadTotal + pageOverhead + indexOverhead;
    return { lines, payloadTotal, pageOverhead, indexOverhead, total };
  }, [rows]);

  const updateRow = (id: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const setPreset = (id: number, presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId)!;
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? { ...r, preset: presetId, name: presetId === 'custom' ? r.name : preset.label.toLowerCase(), bytesPerRow: preset.bytesPerRow }
          : r
      )
    );
  };

  const addRow = () => setRows((rs) => [...rs, makeRow()]);
  const removeRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const num = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return (
    <div className="m-page">
      <style>{`
        .tool-hero { text-align: center; padding: 5rem 1.5rem 3.5rem; max-width: 52rem; margin: 0 auto; }
        .tool-card { background: var(--bg-soft); border: 1px solid var(--line); border-radius: 14px; padding: 1.75rem; margin-bottom: 1.25rem; }
        .tbl-row { display: grid; grid-template-columns: 1fr 1.4fr 1fr 1fr 2.5rem; gap: 0.75rem; align-items: end; padding: 0.9rem 0; border-bottom: 1px solid var(--line); }
        .tbl-row.head { padding: 0 0 0.5rem; border-bottom: 1px solid var(--line); align-items: start; }
        .tbl-row.head span { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); }
        @media (max-width: 700px) {
          .tbl-row { grid-template-columns: 1fr 1fr; }
          .tbl-row .hide-sm { display: none; }
        }
        .tool-field label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--muted); margin-bottom: 0.35rem; }
        .tool-field input, .tool-field select { width: 100%; padding: 0.6rem 0.7rem; border: 1px solid var(--line); border-radius: 8px; font-size: 0.95rem; background: var(--bg-softer); color: var(--ink); font-family: inherit; }
        .tool-field input:focus, .tool-field select:focus { outline: none; border-color: var(--amber); }
        .rm-btn { background: transparent; border: 1px solid var(--line); color: var(--faint); border-radius: 8px; width: 2.2rem; height: 2.2rem; cursor: pointer; font-size: 1rem; }
        .rm-btn:hover { border-color: var(--red); color: var(--red); }
        .breakdown .row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.8rem 0; border-bottom: 1px solid var(--line); }
        .breakdown .row:last-of-type { border-bottom: none; }
        .breakdown .label { color: var(--muted); }
        .breakdown .value { font-weight: 700; white-space: nowrap; }
        .payoff { background: var(--amber-dim); border: 1px solid rgba(245,158,11,0.35); border-radius: 14px; padding: 2.25rem; text-align: center; margin: 2rem 0; }
        .payoff .size { font-size: 3rem; font-weight: 800; letter-spacing: -0.03em; color: var(--amber); line-height: 1; }
        .payoff p { margin: 1rem 0 0; font-size: 1.15rem; color: var(--ink); font-weight: 600; }
        .fine { font-size: 0.85rem; color: var(--faint); }
        .notes li { margin-bottom: 0.7rem; line-height: 1.65; color: var(--muted); }
        .notes li strong { color: var(--ink); }
      `}</style>

      {/* HERO */}
      <section className="tool-hero">
        <span className="kicker">Tools · SQLite Size Estimator</span>
        <h1>
          Your entire database <span className="hl">fits in one file.</span>
        </h1>
        <p className="lede" style={{ margin: '0 auto' }}>
          Add your tables, set rows and row sizes, and see how big your whole
          database really is. Spoiler: smaller than your node_modules folder.
        </p>
      </section>

      <div className="m-wrap" style={{ maxWidth: '60rem', paddingBottom: '5rem' }}>
        {/* TABLES */}
        <div className="tool-card">
          <h2 className="h3">Your tables</h2>
          <div style={{ marginTop: '1rem' }}>
            <div className="tbl-row head hide-sm">
              <span>Table type</span>
              <span>Name</span>
              <span>Rows</span>
              <span>Bytes / row</span>
              <span></span>
            </div>
            {rows.map((r) => (
              <div className="tbl-row" key={r.id}>
                <div className="tool-field">
                  <label>Type preset</label>
                  <select value={r.preset} onChange={(e) => setPreset(r.id, e.target.value)}>
                    {PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="tool-field">
                  <label>Table name</label>
                  <input
                    value={r.name}
                    onChange={(e) => updateRow(r.id, { name: e.target.value })}
                    placeholder="users"
                  />
                </div>
                <div className="tool-field">
                  <label>Rows</label>
                  <input
                    type="number"
                    min={0}
                    value={r.rows}
                    onChange={(e) => updateRow(r.id, { rows: num(e.target.value, 0) })}
                  />
                </div>
                <div className="tool-field">
                  <label>Bytes / row</label>
                  <input
                    type="number"
                    min={0}
                    value={r.bytesPerRow}
                    onChange={(e) => updateRow(r.id, { bytesPerRow: num(e.target.value, 0), preset: 'custom' })}
                  />
                </div>
                <div>
                  <button className="rm-btn" onClick={() => removeRow(r.id)} aria-label="Remove table" title="Remove table">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.25rem' }}>
            <button className="btn secondary" onClick={addRow}>
              + Add table
            </button>
          </div>
          <p className="fine" style={{ marginTop: '1rem', marginBottom: 0 }}>
            Presets are typical payload sizes — edit bytes per row if you know your real
            row size. Editing it switches that row to Custom.
          </p>
        </div>

        {/* BREAKDOWN */}
        <div className="tool-card">
          <h2 className="h3">The breakdown</h2>
          <div className="breakdown" style={{ marginTop: '1rem' }}>
            {calc.lines.map((l) => (
              <div className="row" key={l.id}>
                <span className="label">
                  {l.name || 'unnamed'} — {fmtNum(l.rows)} rows × {fmtNum(l.bytesPerRow)} B
                </span>
                <span className="value">{fmtBytes(l.payload)}</span>
              </div>
            ))}
            <div className="row">
              <span className="label">SQLite page overhead (~15%)</span>
              <span className="value">{fmtBytes(calc.pageOverhead)}</span>
            </div>
            <div className="row">
              <span className="label">Indexes (~25%, rule of thumb)</span>
              <span className="value">{fmtBytes(calc.indexOverhead)}</span>
            </div>
          </div>
        </div>

        {/* PAYOFF */}
        <div className="payoff">
          <div className="size">{fmtBytes(calc.total)}</div>
          <p>This file is your entire database. Copy it and you own everything.</p>
        </div>

        {/* HONEST NOTES */}
        <div className="tool-card">
          <h2 className="h3">Honest notes on the math</h2>
          <ul className="notes" style={{ paddingLeft: '1.2rem', marginTop: '1rem' }}>
            <li>
              <strong>15% page overhead is a rule of thumb, not a measurement.</strong> SQLite
              stores data in fixed-size pages; rows that don’t divide evenly leave slack.
              Real overhead lands somewhere between 5% and 25% depending on row size.
            </li>
            <li>
              <strong>Indexes cost real space.</strong> Every index is a second copy of the
              indexed columns plus pointers. The 25% line assumes a few indexes per table —
              a heavily indexed table can double it, a table with none pays zero.
            </li>
            <li>
              <strong>The WAL file adds temporary size.</strong> Write-ahead logging keeps a
              separate journal during heavy writes. It checkpoints and shrinks, but don’t
              measure your file mid-import and panic.
            </li>
            <li>
              <strong>Deleted rows leave holes until VACUUM.</strong> SQLite marks deleted
              space for reuse rather than shrinking the file. Your file may read larger
              than your live data — that’s normal.
            </li>
            <li>
              <strong>Embeddings are the exception that proves the rule.</strong> A million
              768-dim vectors is ~3 GB — genuinely large. It’s also a single file you can
              rsync, back up, and carry between providers. Try that with a managed vector
              service.
            </li>
          </ul>
        </div>

        <ToolCrossLinks current="/tools/sqlite-estimator" />

        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <a className="m-btn" href="/signup">
            Get a database you can hold — first month $1
          </a>
        </div>
      </div>
    </div>
  );
}
