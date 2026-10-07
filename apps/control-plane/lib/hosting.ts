import { getConnection, getConnectionForUser, type HostingConnection } from './connection';

export type HostingMode = 'HOSTED' | 'BYOH';

export function normalizeHostingMode(value: unknown): HostingMode {
  return String(value ?? '').toUpperCase() === 'HOSTED' ? 'HOSTED' : 'BYOH';
}

/** Managed projects always use the platform owner's stored cPanel connection. */
export async function getPlatformConnection(): Promise<HostingConnection | null> {
  return getConnection();
}

/** BYOH projects use only the authenticated customer's own connection. */
export async function getByohConnection(userId: string): Promise<HostingConnection | null> {
  return getConnectionForUser(userId);
}

export function hostedBaseDomain(conn: HostingConnection): string {
  const configured = process.env.HOSTED_BASE_DOMAIN?.trim();
  return configured || conn.mainDomain;
}

export const HOSTED_STORAGE_LIMIT_MB = 512;
