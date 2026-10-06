/**
 * InvisibleDB — JWT Decoder.
 *
 * Paste a JWT → header/payload pretty-printed, expiry check, alg:none warning.
 * Signature is NOT verified (that needs the secret) — the page says so.
 */
'use client';

import { useState } from 'react';
import { CopyButton, SecurityNote, ToolHero } from '../components';

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function relTime(expMs: number, nowMs: number): string {
  const diff = expMs - nowMs;
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [1000, 'second'],
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
  ];
  let label = `${abs} ms`;
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms);
      label = `${n} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return diff < 0 ? `${label} ago` : `in ${label}`;
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const pretty = JSON.stringify(value, null, 2);
  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        border: '1px solid var(--line)',
        borderRadius: '10px',
        background: 'var(--bg-soft)',
        marginTop: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{title}</strong>
        <CopyButton text={pretty} small />
      </div>
      <pre
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.85rem',
          color: 'var(--ink)',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {pretty}
      </pre>
    </div>
  );
}

export default function JwtDecoderPage() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [header, setHeader] = useState<Record<string, unknown> | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [signature, setSignature] = useState('');

  const decode = (token: string) => {
    setError('');
    setHeader(null);
    setPayload(null);
    setSignature('');
    const t = token.trim();
    if (!t) return;
    const parts = t.split('.');
    if (parts.length !== 3) {
      setError('Not a JWT — expected three dot-separated segments (header.payload.signature).');
      return;
    }
    try {
      const h = JSON.parse(base64UrlDecode(parts[0])) as Record<string, unknown>;
      const p = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
      setHeader(h);
      setPayload(p);
      setSignature(parts[2]);
    } catch {
      setError('Could not decode — the header or payload is not valid base64url JSON.');
    }
  };

  const alg = header ? String(header.alg ?? '') : '';
  const exp = payload && typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  const now = Date.now();
  const expired = exp !== null && exp < now;

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>JWT <span className="hl">Decoder</span></>}
        lede="Inspect any JSON Web Token: header, claims, and expiry — without sending it anywhere."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div className="field">
            <label>Paste your JWT</label>
            <textarea
              rows={4}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                decode(e.target.value);
              }}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.85rem' }}
            />
          </div>

          {error && (
            <div className="callout">
              <p>{error}</p>
            </div>
          )}

          {alg === 'none' && (
            <div className="callout" style={{ borderLeftColor: '#f87171' }}>
              <p>
                <strong>⚠️ Algorithm is <span className="m-inline-code">none</span>.</strong> This
                token is unsigned — anyone can forge it. Never accept{' '}
                <span className="m-inline-code">alg: none</span> tokens in production.
              </p>
            </div>
          )}

          {exp !== null && (
            <div
              className="callout"
              style={expired ? { borderLeftColor: '#f87171' } : undefined}
            >
              <p>
                {expired ? (
                  <>
                    <strong>⏰ Expired</strong> {relTime(exp, now)} —{' '}
                    {new Date(exp).toUTCString()}.
                  </>
                ) : (
                  <>
                    <strong>⏰ Expires {relTime(exp, now)}</strong> —{' '}
                    {new Date(exp).toUTCString()}.
                  </>
                )}
              </p>
            </div>
          )}

          {header && <JsonBlock title="Header" value={header} />}
          {payload && <JsonBlock title="Payload (claims)" value={payload} />}
          {signature && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
              Signature: <code style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8rem', wordBreak: 'break-all' }}>{signature.slice(0, 24)}…</code>{' '}
              (not verified — verification needs the secret, which never leaves your server)
            </div>
          )}

          <SecurityNote />
        </div>
      </section>
    </div>
  );
}
