'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

const CUSTOMER_APP_PREFIXES = ['/projects', '/billing', '/byoh', '/hosted', '/dashboard'];
const DB_SECTIONS = ['overview', 'connect', 'auth', 'database', 'storage', 'vector', 'realtime', 'backups', 'settings'] as const;

function isCustomerAppRoute(pathname: string) {
  return CUSTOMER_APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (!isCustomerAppRoute(pathname)) {
    return <main className="m-wrap">{children}</main>;
  }

  const parts = pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'projects' && parts.length >= 2 ? parts[1] : null;
  const section = slug && parts.length >= 3 ? parts[2] : 'overview';

  const databaseItems = useMemo(
    () => slug
      ? DB_SECTIONS.map((item) => ({
          label: titleCase(item),
          href: `/projects/${encodeURIComponent(slug)}/${item}`,
          active: section === item,
        }))
      : [],
    [slug, section],
  );

  const primaryItems = [
    { label: 'Databases', href: '/projects', active: pathname === '/projects' },
    { label: 'Documentation', href: '/dashboard/docs', active: pathname.startsWith('/dashboard/docs') },
    { label: 'Billing', href: '/dashboard/billing', active: pathname.startsWith('/dashboard/billing') },
  ];

  const sidebar = (
    <>
      <div className="idb-sidebar-head">
        <div className="idb-sidebar-label">Workspace</div>
      </div>
      <nav className="idb-nav" aria-label="Control panel">
        {primaryItems.map((item) => (
          <a key={item.href} href={item.href} className={item.active ? 'active' : ''}>
            {item.label}
          </a>
        ))}
      </nav>

      {slug ? (
        <>
          <div className="idb-sidebar-divider" />
          <div className="idb-db-context">
            <div className="idb-sidebar-label">Database</div>
            <strong>{slug}</strong>
          </div>
          <nav className="idb-nav" aria-label={`${slug} database`}>
            {databaseItems.map((item) => (
              <a key={item.href} href={item.href} className={item.active ? 'active' : ''}>
                {item.label}
              </a>
            ))}
          </nav>
        </>
      ) : null}

      <div className="idb-sidebar-spacer" />
      <div className="idb-sidebar-divider" />
      <nav className="idb-nav idb-nav-secondary" aria-label="Account">
        <a href="/">Website</a>
        <a href="/logout">Sign out</a>
      </nav>
    </>
  );

  return (
    <div className="idb-app-shell">
      <style>{`
        .idb-app-shell{min-height:100vh;background:#080808;color:#f7f7f7}
        .idb-topbar{position:sticky;top:0;z-index:50;height:64px;border-bottom:1px solid #242424;background:rgba(8,8,8,.96);backdrop-filter:blur(14px);display:flex;align-items:center;padding:0 18px;gap:14px}
        .idb-menu-btn{display:none;width:42px;height:42px;border:1px solid #2b2b2b;border-radius:10px;background:#121212;color:#fff;font-size:24px;line-height:1;align-items:center;justify-content:center;cursor:pointer}
        .idb-brand{color:#fff;text-decoration:none;font-size:20px;font-weight:850;white-space:nowrap}.idb-brand span{color:#ff9f00}
        .idb-topbar-context{color:#858585;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.idb-topbar-actions{margin-left:auto;display:flex;gap:10px;align-items:center}.idb-topbar-actions a{color:#aaa;text-decoration:none;font-size:14px}.idb-topbar-actions a:last-child{color:#ff9f00;font-weight:700}
        .idb-layout{max-width:1440px;margin:0 auto;display:grid;grid-template-columns:250px minmax(0,1fr);min-height:calc(100vh - 64px)}
        .idb-sidebar{position:sticky;top:64px;height:calc(100vh - 64px);border-right:1px solid #202020;padding:18px 14px;display:flex;flex-direction:column;overflow-y:auto;background:#0a0a0a}
        .idb-sidebar-head{padding:0 10px 8px}.idb-sidebar-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#666;font-weight:800}.idb-db-context{padding:0 10px 10px}.idb-db-context strong{display:block;margin-top:5px;overflow:hidden;text-overflow:ellipsis}
        .idb-nav{display:grid;gap:4px}.idb-nav a{display:flex;align-items:center;min-height:40px;padding:9px 10px;border-radius:8px;color:#bdbdbd;text-decoration:none;font-size:14px;font-weight:650}.idb-nav a:hover{background:#141414;color:#fff}.idb-nav a.active{background:#201600;color:#ffb12b;border:1px solid #4c3100}.idb-nav-secondary a{color:#8d8d8d}
        .idb-sidebar-divider{height:1px;background:#202020;margin:14px 6px}.idb-sidebar-spacer{flex:1}
        .idb-content{min-width:0;width:100%;max-width:1120px;margin:0 auto;padding:32px 28px 72px}
        .idb-drawer-backdrop{display:none}.idb-drawer{display:none}
        @media(max-width:820px){
          .idb-menu-btn{display:flex}.idb-topbar{padding:0 12px}.idb-topbar-context{display:none}.idb-topbar-actions a:first-child{display:none}
          .idb-layout{display:block}.idb-sidebar{display:none}.idb-content{padding:24px 16px 60px}
          .idb-drawer-backdrop{display:block;position:fixed;inset:64px 0 0 0;background:rgba(0,0,0,.62);z-index:60;border:0;padding:0}
          .idb-drawer{display:flex;flex-direction:column;position:fixed;z-index:70;top:64px;bottom:0;left:0;width:min(86vw,320px);background:#0a0a0a;border-right:1px solid #292929;padding:18px 14px;overflow-y:auto;box-shadow:20px 0 50px rgba(0,0,0,.45)}
        }
      `}</style>

      <header className="idb-topbar">
        <button
          className="idb-menu-btn"
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          ☰
        </button>
        <a href="/projects" className="idb-brand"><span>Invisible</span>DB</a>
        <div className="idb-topbar-context">{slug ? `${slug} / ${titleCase(section)}` : 'Control Panel'}</div>
        <div className="idb-topbar-actions">
          <a href="/">Website</a>
          <a href="/logout">Sign out</a>
        </div>
      </header>

      {open ? (
        <>
          <button className="idb-drawer-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <aside className="idb-drawer">{sidebar}</aside>
        </>
      ) : null}

      <div className="idb-layout">
        <aside className="idb-sidebar">{sidebar}</aside>
        <main className="idb-content">{children}</main>
      </div>
    </div>
  );
}
