'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const APP_ROUTE_PREFIXES = ['/projects', '/billing', '/byoh', '/hosted', '/admin'];

function isAppRoute(pathname: string) {
  return APP_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function PublicSiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isAppRoute(pathname)) return null;

  return <>{children}</>;
}
