import { getConnection, type HostingConnection } from './connection';

export type HostingMode = 'HOSTED' | 'BYOH';

export function normalizeHostingMode(value: unknown): HostingMode {
  return String(value ?? '').toUpperCase() === 'HOSTED' ? 'HOSTED' : 'BYOH';
}

/**
 * Hosted projects run on the platform owner's cPanel account. For the current
 * single-account launch this is the same encrypted connection already stored
 * by the control plane. When reseller/WHM lands later, only this resolver needs
 * to change; customer-facing hosted flows stay the same.
 */
export async function getPlatformConnection(): Promise<HostingConnection | null> {
  return getConnection();
}

/** BYOH projects use a customer-supplied hosting connection. */
export async function getByohConnection(): Promise<HostingConnection | null> {
  return getConnection();
}

export function hostedBaseDomain(conn: HostingConnection): string {
  const configured = process.env.HOSTED_BASE_DOMAIN?.trim();
  return configured || conn.mainDomain;
}
