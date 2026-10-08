'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const CUSTOMER_APP_PREFIXES = ['/projects', '/billing', '/byoh', '/hosted'];

function isCustomerAppRoute(pathname: string) {
  return CUSTOMER_APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (!isCustomerAppRoute(pathname)) {
    return <main className="m-wrap">{children}</main>;
  }

  const databaseActive = pathname === '/projects' || pathname.startsWith('/projects/');

  return (
    <div style={{ minHeight: '100vh', background: '#080808', color: '#f7f7f7' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          borderBottom: '1px solid #242424',
          background: 'rgba(8,8,8,.96)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: '0 auto',
            minHeight: 64,
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <a href="/projects" style={{ color: '#fff', textDecoration: 'none', fontSize: 21, fontWeight: 800 }}>
            <span style={{ color: '#ff9f00' }}>Invisible</span>DB
          </a>
          <span style={{ color: '#555' }}>/</span>
          <span style={{ color: '#aaa', fontSize: 14 }}>Control Panel</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/docs" style={{ color: '#bdbdbd', textDecoration: 'none', fontSize: 14 }}>Docs</a>
            <a href="/" style={{ color: '#bdbdbd', textDecoration: 'none', fontSize: 14 }}>Website</a>
            <a href="/logout" style={{ color: '#ff9f00', textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Sign out</a>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1320,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
        }}
      >
        <nav
          aria-label="Dashboard"
          style={{
            borderBottom: '1px solid #1f1f1f',
            padding: '10px 18px',
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            position: 'sticky',
            top: 64,
            zIndex: 20,
            background: '#080808',
          }}
        >
          <a href="/projects" style={navStyle(databaseActive)}>Databases</a>
          <a href="/projects#connect" style={navStyle(false)}>Connect</a>
          <a href="/projects#activity" style={navStyle(false)}>Activity</a>
          <a href="/api/billing/portal" style={navStyle(false)}>Billing</a>
          <a href="/docs" style={navStyle(false)}>API Docs</a>
        </nav>

        <main style={{ width: '100%', maxWidth: 1160, margin: '0 auto', padding: '28px 20px 72px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function navStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? '#0b0b0b' : '#d0d0d0',
    background: active ? '#ff9f00' : '#151515',
    border: active ? '1px solid #ff9f00' : '1px solid #292929',
    borderRadius: 999,
    padding: '9px 14px',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: active ? 800 : 600,
    whiteSpace: 'nowrap',
  };
}
