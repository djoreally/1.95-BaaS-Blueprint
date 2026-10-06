/**
 * InvisibleDB — Secret Key Generator.
 *
 * Cryptographically secure keys via crypto.getRandomValues. Never Math.random.
 * Formats: hex, base64, base64url, alphanumeric, UUID v4.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CopyButton, KeyRow, SecurityNote, ToolHero } from '../components';

type Format = 'hex' | 'base64' | 'base64url' | 'alphanumeric' | 'uuid';

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: 'hex', label: 'Hex', hint: '0-9a-f, 2 chars per byte' },
  { id: 'base64', label: 'Base64', hint: 'Standard, padded' },
  { id: 'base64url', label: 'Base64URL', hint: 'URL-safe, no padding' },
  { id: 'alphanumeric', label: 'Alphanumeric', hint: 'A–Za–z0–9' },
  { id: 'uuid', label: 'UUID v4', hint: 'RFC 4122, fixed length' },
];

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b); // never Math.random
  return b;
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function toBase64(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

function toBase64Url(b: Uint8Array): string {
  return toBase64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toAlphanumeric(byteLength: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // Rejection sampling (248 = 62 * 4) avoids modulo bias.
  let out = '';
  const buf = new Uint8Array(128);
  while (out.length < byteLength) {
    crypto.getRandomValues(buf);
    for (const x of buf) {
      if (x < 248) {
        out += chars[x % 62];
        if (out.length === byteLength) break;
      }
    }
  }
  return out;
}

function generateOne(format: Format, byteLength: number): string {
  switch (format) {
    case 'hex':
      return toHex(randomBytes(byteLength));
    case 'base64':
      return toBase64(randomBytes(byteLength));
    case 'base64url':
      return toBase64Url(randomBytes(byteLength));
    case 'alphanumeric':
      return toAlphanumeric(byteLength);
    case 'uuid':
      return crypto.randomUUID();
  }
}

export default function SecretKeyGeneratorPage() {
  const [format, setFormat] = useState<Format>('base64url');
  const [byteLength, setByteLength] = useState(32);
  const [count, setCount] = useState(1);
  const [keys, setKeys] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const regenerate = useCallback(() => {
    setKeys(Array.from({ length: count }, () => generateOne(format, byteLength)));
  }, [format, byteLength, count]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const bits = useMemo(
    () => (format === 'uuid' ? 122 : byteLength * 8),
    [format, byteLength],
  );

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(keys.join('\n'));
    } catch {
      /* clipboard unavailable */
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  return (
    <div className="m-page">
      <ToolHero
        kicker="Developer tools"
        title={<>Secret Key <span className="hl">Generator</span></>}
        lede="API keys, tokens, and secrets — generated with the Web Crypto API, right here in your browser."
      />

      <section className="m-section" style={{ borderTop: 'none', paddingTop: '1rem' }}>
        <div className="m-wrap" style={{ maxWidth: '56rem' }}>
          <div className="m-card" style={{ marginBottom: '1.5rem' }}>
            <div className="field">
              <label>Format</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`m-btn ghost small${format === f.id ? '' : ''}`}
                    onClick={() => setFormat(f.id)}
                    title={f.hint}
                    style={
                      format === f.id
                        ? { borderColor: 'var(--amber)', color: 'var(--amber)', fontWeight: 700 }
                        : undefined
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {format !== 'uuid' && (
              <div className="field" style={{ marginTop: '1.25rem' }}>
                <label>
                  Entropy: {byteLength} bytes ({bits} bits)
                </label>
                <input
                  type="range"
                  className="tool-range"
                  min={16}
                  max={128}
                  step={1}
                  value={byteLength}
                  onChange={(e) => setByteLength(Number(e.target.value))}
                  aria-label="Key length in bytes"
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div className="field" style={{ marginTop: '1.25rem' }}>
              <label>Batch size: {count}</label>
              <input
                type="range"
                className="tool-range"
                min={1}
                max={20}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                aria-label="Number of keys to generate"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="m-btn" onClick={regenerate}>
                Regenerate
              </button>
              {count > 1 && (
                <button type="button" className="m-btn ghost" onClick={copyAll}>
                  {copiedAll ? 'Copied all ✓' : 'Copy all'}
                </button>
              )}
            </div>
          </div>

          <div>
            {keys.map((k, i) => (
              <KeyRow key={`${i}-${k.slice(0, 8)}`} value={k} />
            ))}
          </div>

          <SecurityNote />

          <div className="callout">
            <p>
              <strong>How strong is this?</strong> {bits} bits of entropy means an
              attacker would need on average 2<sup>{bits - 1}</sup> guesses. At a
              trillion guesses per second, that&apos;s longer than the age of the
              universe. Use at least 32 bytes (256 bits) for production secrets.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
