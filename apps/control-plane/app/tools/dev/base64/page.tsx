/**
 * InvisibleDB — Base64 Encoder / Decoder.
 *
 * Unicode-safe: TextEncoder/TextDecoder around the binary string.
 */
'use client';

import { useState } from 'react';
import { CopyButton, SecurityNote, ToolHero } from '../components';

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToUtf8(s: string): string {
  const clean = s.replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64Page() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const run = (m: 'encode' | 'decode', text: string) => {
    setError('');
    try {
      setOutput(m === 'encode' ? utf8ToBase64(text) : base64ToUtf8(text));
    } catch {
      setOutput('');
      setError('Invalid Base64 input — check for typos or truncated padding.');
    }
  };

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>Base64 <span className="hl">Encoder / Decoder</span></>}
        lede="Unicode-safe Base64 in both directions. Handles emoji and non-Latin text correctly."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {(['encode', 'decode'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="m-btn ghost small"
                onClick={() => {
                  setMode(m);
                  run(m, input);
                }}
                style={
                  mode === m
                    ? { borderColor: 'var(--amber)', color: 'var(--amber)', fontWeight: 700 }
                    : undefined
                }
              >
                {m === 'encode' ? 'Encode →' : '← Decode'}
              </button>
            ))}
          </div>

          <div className="field">
            <label>{mode === 'encode' ? 'Text to encode' : 'Base64 to decode'}</label>
            <textarea
              rows={5}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                run(mode, e.target.value);
              }}
              placeholder={mode === 'encode' ? 'Hello, 世界 🌍' : 'SGVsbG8sIOS4lueVjCDwn4yN'}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.92rem' }}
            />
          </div>

          {error && (
            <div className="callout">
              <p>{error}</p>
            </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Result</strong>
                <CopyButton text={output} small />
              </div>
              <code
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.85rem',
                  wordBreak: 'break-all',
                  color: 'var(--ink)',
                }}
              >
                {output}
              </code>
            </div>
          )}

          <SecurityNote />
        </div>
      </section>
    </div>
  );
}
