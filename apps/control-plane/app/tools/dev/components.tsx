/**
 * InvisibleDB — shared components for the /tools/dev suite.
 *
 * SecurityNote: the trust pitch — everything runs client-side via Web Crypto.
 * CopyButton: clipboard with fallback + "Copied" feedback.
 * ToolHero: compact hero for tool pages.
 */
'use client';

import { useState } from 'react';

export function SecurityNote() {
  return (
    <div className="callout" style={{ marginTop: '1.5rem' }}>
      <p>
        <strong>🔒 Runs 100% in your browser.</strong> Keys are generated with the
        Web Crypto API (<span className="m-inline-code">crypto.getRandomValues</span> /{' '}
        <span className="m-inline-code">crypto.randomUUID</span>) — never{' '}
        <span className="m-inline-code">Math.random</span> — and nothing on this
        page ever leaves your device. Not even to us.
      </p>
    </div>
  );
}

export function CopyButton({ text, small }: { text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      className={`m-btn ghost${small ? ' small' : ''}`}
      onClick={copy}
      aria-label="Copy to clipboard"
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  );
}

export function ToolHero({
  kicker,
  title,
  lede,
}: {
  kicker: string;
  title: React.ReactNode;
  lede: string;
}) {
  return (
    <section className="m-hero" style={{ padding: '4rem 1.5rem 2rem' }}>
      <span className="kicker">{kicker}</span>
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)' }}>{title}</h1>
      <p className="sub">{lede}</p>
    </section>
  );
}

export function KeyRow({ value, mono = true }: { value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        border: '1px solid var(--line)',
        borderRadius: '10px',
        background: 'var(--bg-soft)',
        marginBottom: '0.6rem',
      }}
    >
      <code
        style={{
          flex: 1,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          fontSize: '0.88rem',
          wordBreak: 'break-all',
          color: 'var(--ink)',
        }}
      >
        {value}
      </code>
      <CopyButton text={value} small />
    </div>
  );
}
