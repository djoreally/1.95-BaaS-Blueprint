import { ImageResponse } from 'next/og';

/**
 * Default Open Graph image for the whole site (1200×630).
 * Rendered server-side by Next.js — no image file to maintain, and the URL
 * is real (this route), never invented.
 */
export const alt = 'InvisibleDB — the invisible backend for web and mobile apps';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '96px',
          background: '#0a0a0f',
          color: '#f5f3ee',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ color: '#f59e0b' }}>Invisible</span>DB
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            marginTop: 32,
            maxWidth: 980,
          }}
        >
          Every backend Firebase gives you. None of the bill.
        </div>
        <div style={{ fontSize: 32, color: '#a8a29e', marginTop: 32 }}>
          $6.99/mo flat · first month $1 · the database file is yours
        </div>
      </div>
    ),
    { ...size }
  );
}
