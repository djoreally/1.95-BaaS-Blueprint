/**
 * InvisibleDB — JSON Formatter.
 *
 * Format / minify / validate with precise error locations.
 */
'use client';

import { useState } from 'react';
import { CopyButton, SecurityNote, ToolHero } from '../components';

function locateError(input: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const m = /position (\d+)/.exec(msg);
  if (!m) return msg;
  const pos = Number(m[1]);
  const before = input.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  const snippet = input.split('\n')[line - 1] ?? '';
  return `${msg} → line ${line}, column ${col}: "${snippet.trim().slice(0, 60)}"`;
}

export default function JsonFormatterPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState('');

  const parse = (text: string): { ok: boolean; value?: unknown; err?: string } => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      return { ok: false, err: locateError(text, e) };
    }
  };

  const format = () => {
    const r = parse(input);
    if (!r.ok) {
      setOutput('');
      setStats('');
      setError(r.err ?? 'Invalid JSON.');
      return;
    }
    setError('');
    setOutput(JSON.stringify(r.value, null, 2));
    setStats(`${input.length} → ${JSON.stringify(r.value, null, 2).length} chars`);
  };

  const minify = () => {
    const r = parse(input);
    if (!r.ok) {
      setOutput('');
      setStats('');
      setError(r.err ?? 'Invalid JSON.');
      return;
    }
    setError('');
    setOutput(JSON.stringify(r.value));
    setStats(`${input.length} → ${JSON.stringify(r.value).length} chars`);
  };

  const validate = () => {
    if (!input.trim()) {
      setError('Nothing to validate yet.');
      setOutput('');
      setStats('');
      return;
    }
    const r = parse(input);
    if (r.ok) {
      setError('');
      setOutput('');
      setStats('✓ Valid JSON');
    } else {
      setError(r.err ?? 'Invalid JSON.');
      setOutput('');
      setStats('');
    }
  };

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>JSON <span className="hl">Formatter</span></>}
        lede="Format, minify, and validate JSON — with errors that point at the exact line and column."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button type="button" className="m-btn small" onClick={format}>
              Format
            </button>
            <button type="button" className="m-btn ghost small" onClick={minify}>
              Minify
            </button>
            <button type="button" className="m-btn ghost small" onClick={validate}>
              Validate
            </button>
          </div>

          <div className="field">
            <label>JSON input</label>
            <textarea
              rows={8}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"name": "invisibledb", "seats": 1}'
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.9rem' }}
            />
          </div>

          {error && (
            <div className="callout" style={{ borderLeftColor: '#f87171' }}>
              <p>
                <strong>Invalid JSON.</strong> {error}
              </p>
            </div>
          )}

          {stats && !error && (
            <p style={{ color: 'var(--amber)', fontWeight: 700, fontSize: '0.95rem' }}>{stats}</p>
          )}

          {output && (
            <div
              style={{
                padding: '1rem 1.25rem',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                background: 'var(--bg-soft)',
                marginTop: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                <CopyButton text={output} small />
              </div>
              <pre
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.85rem',
                  color: 'var(--ink)',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '24rem',
                  overflowY: 'auto',
                }}
              >
                {output}
              </pre>
            </div>
          )}

          <SecurityNote />
        </div>
      </section>
    </div>
  );
}
