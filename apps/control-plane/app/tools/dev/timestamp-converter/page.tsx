/**
 * InvisibleDB — Timestamp Converter.
 *
 * Unix seconds / milliseconds ↔ ISO 8601 ↔ human readable, plus "now".
 */
'use client';

import { useState } from 'react';
import { CopyButton, SecurityNote, ToolHero } from '../components';

function relTime(ts: number): string {
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  if (abs < 1000) return 'just now';
  const units: [number, string][] = [
    [1000, 'second'],
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
    [604_800_000, 'week'],
    [2_629_800_000, 'month'],
    [31_557_600_000, 'year'],
  ];
  let label = '';
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms);
      label = `${n} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return diff < 0 ? `${label} ago` : `in ${label}`;
}

export default function TimestampConverterPage() {
  const [input, setInput] = useState('');
  const [ts, setTs] = useState<number | null>(null);
  const [error, setError] = useState('');

  const parse = (raw: string) => {
    setError('');
    const t = raw.trim();
    if (!t) {
      setTs(null);
      return;
    }
    // Plain number → seconds or ms (heuristic: > 1e12 is ms)
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      const n = Number(t);
      setTs(n > 1e12 || n < -1e12 ? Math.round(n) : Math.round(n * 1000));
      return;
    }
    // ISO / date string
    const d = new Date(t);
    if (!isNaN(d.getTime())) {
      setTs(d.getTime());
      return;
    }
    setTs(null);
    setError('Unrecognized format — try unix seconds, milliseconds, or ISO 8601.');
  };

  const now = () => {
    const n = Date.now();
    setInput(String(Math.floor(n / 1000)));
    setTs(n);
    setError('');
  };

  const rows =
    ts === null
      ? []
      : [
          { label: 'Unix seconds', value: String(Math.floor(ts / 1000)) },
          { label: 'Unix milliseconds', value: String(ts) },
          { label: 'ISO 8601 (UTC)', value: new Date(ts).toISOString() },
          { label: 'UTC', value: new Date(ts).toUTCString() },
          { label: 'Local', value: new Date(ts).toString() },
          { label: 'Relative', value: relTime(ts) },
        ];

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>Timestamp <span className="hl">Converter</span></>}
        lede="Unix seconds, milliseconds, ISO 8601, and human time — convert any direction."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1, minWidth: '16rem', marginBottom: 0 }}>
              <label>Timestamp or date</label>
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  parse(e.target.value);
                }}
                placeholder="1728000000 · 1728000000000 · 2026-10-06T12:00:00Z"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              />
            </div>
            <button type="button" className="m-btn ghost" onClick={now}>
              Now
            </button>
          </div>

          {error && (
            <div className="callout" style={{ marginTop: '1rem' }}>
              <p>{error}</p>
            </div>
          )}

          {rows.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              {rows.map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.7rem 1rem',
                    border: '1px solid var(--line)',
                    borderRadius: '10px',
                    background: 'var(--bg-soft)',
                    marginBottom: '0.5rem',
                  }}
                >
                  <span style={{ width: '10rem', flexShrink: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {r.label}
                  </span>
                  <code
                    style={{
                      flex: 1,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.88rem',
                      wordBreak: 'break-all',
                      color: 'var(--ink)',
                    }}
                  >
                    {r.value}
                  </code>
                  <CopyButton text={r.value} small />
                </div>
              ))}
            </div>
          )}

          <SecurityNote />
        </div>
      </section>
    </div>
  );
}
