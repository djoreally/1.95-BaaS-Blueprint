/**
 * Hosting connection store — server-side, in-memory.
 *
 * The control plane authenticates to the customer's cPanel with an API
 * token (NEVER a password). For this MVP the connection lives in server
 * memory; production must move it to an encrypted vault (per-customer,
 * encrypted at rest, never logged).
 */
export interface HostingConnection {
  host: string;
  user: string;
  apiToken: string;
  mainDomain: string;
  domains: string[];
  connectedAt: string;
}

let connection: HostingConnection | null = null;

export function getConnection(): HostingConnection | null {
  return connection;
}

export function setConnection(c: HostingConnection): void {
  connection = c;
}

export function clearConnection(): void {
  connection = null;
}
