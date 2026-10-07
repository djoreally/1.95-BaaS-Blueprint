/**
 * InvisibleDBClient — the agent-facing contract for the InvisibleDB control plane.
 *
 * Every consumer (MCP server, CLI, future SDKs) programs against this interface,
 * never against HTTP directly. The HTTP layer is a swappable `HttpTransport`,
 * so the client wires up the moment the control plane REST API lands —
 * nothing above this file changes.
 *
 * Evidence rule: methods return data, never claims. A caller that needs to
 * assert success must check the returned fields (status, evidence refs),
 * never the absence of an exception. No evidence = UNKNOWN.
 */

/** Lifecycle states an instance can be in. */
export type InstanceStatus =
  | 'provisioning'
  | 'ready'
  | 'failed'
  | 'suspended';

/** Billing plan for an instance. `dev` is the free BYOH tier. */
export type InstancePlan = 'seat' | 'dev';

export interface InstanceSummary {
  id: string;
  name: string;
  /** Fully-qualified domain the instance serves, e.g. "acme.invisibledb.io". */
  fqdn: string;
  status: InstanceStatus;
  plan: InstancePlan;
  createdAt: string;
}

export interface ProvisionInput {
  /** URL-safe slug, e.g. "acme-crm". */
  name: string;
  /** Parent domain for the instance. Defaults to the platform domain. */
  domain?: string;
  /** Defaults to "seat". */
  plan?: InstancePlan;
}

export interface InstanceKeys {
  instanceId: string;
  /** Base URL for the instance REST API. */
  baseUrl: string;
  /** Admin UI URL. */
  adminUrl: string;
  /** Scoped API key for this instance. Treat as a secret. */
  apiKey: string;
  /** Ready-to-paste Dart snippet using the PocketBase SDK. */
  dartSnippet: string;
  /** Equivalent curl example. */
  restSnippet: string;
}

export interface QueryOptions {
  page?: number;
  perPage?: number;
}

export interface QueryResult {
  instanceId: string;
  collection: string;
  items: Record<string, unknown>[];
  totalItems: number;
  page: number;
  perPage: number;
}

import type { EvidenceState } from '@baas-195/zeroai-addon';

/**
 * ZeroAI lifecycle gates. Gate ids mirror the lifecycle in
 * packages/zeroai-addon (ZeroGate): every important state transition has a
 * gate, and a gate passes only on VERIFIED evidence.
 */
export type GateName =
  | 'typecheck'
  | 'unit-tests'
  | 'integration-tests'
  | 'security'
  | 'migration-safety'
  | 'production-readiness';

export interface GateCheckResult {
  instanceId: string;
  gate: GateName;
  /**
   * ZeroAI evidence state. VERIFIED = passed. Anything else blocks:
   * PARTIAL, FAILED, and UNKNOWN (no evidence) are all not-passed.
   */
  state: EvidenceState;
  /** Evidence references (test run ids, hashes, log paths). Empty => UNKNOWN. */
  evidence: string[];
  checkedAt: string;
}

export interface ControlPlaneStatus {
  ok: boolean;
  version: string;
  instances: number;
}

/**
 * The single contract. Implementations must be honest: throw only on
 * transport/auth failures, and return UNKNOWN states when evidence is absent.
 */
export interface InvisibleDBClient {
  provision(input: ProvisionInput): Promise<InstanceSummary>;
  list(): Promise<InstanceSummary[]>;
  keys(instance: string): Promise<InstanceKeys>;
  query(
    instance: string,
    collection: string,
    filter?: string,
    opts?: QueryOptions,
  ): Promise<QueryResult>;
  gateCheck(instance: string, gate: GateName): Promise<GateCheckResult>;
  status(): Promise<ControlPlaneStatus>;
}

/**
 * Raw HTTP boundary. The control plane REST API is not live yet; implement
 * this interface against it when it lands (see docs/agents.md for routes).
 */
export interface HttpTransport {
  request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T>;
}

/** Error thrown when no transport is configured. Fail loud, never silently. */
export class NoTransportError extends Error {
  constructor() {
    super(
      'InvisibleDBClient: no HTTP transport configured. ' +
        'Pass an HttpTransport (e.g. fetchTransport(baseUrl, apiKey)) — ' +
        'see packages/mcp-server/README.md.',
    );
    this.name = 'NoTransportError';
  }
}

/** Transport that fails loudly until the real API is wired. */
export function stubTransport(): HttpTransport {
  return {
    async request() {
      throw new NoTransportError();
    },
  };
}

/**
 * Real fetch-based transport. Ready to use the moment the control plane
 * REST API lands — baseUrl like "https://baas.innovarel.dev".
 */
export function fetchTransport(baseUrl: string, apiKey: string): HttpTransport {
  const root = baseUrl.replace(/\/+$/, '');
  return {
    async request<T>(
      method: 'GET' | 'POST' | 'DELETE',
      path: string,
      body?: unknown,
    ): Promise<T> {
      const res = await fetch(`${root}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(
          `InvisibleDB API ${method} ${path}: ${res.status} ${res.statusText}`,
        );
      }
      return (await res.json()) as T;
    },
  };
}

/**
 * In-memory fake transport. Deterministic — for tests and for the CLI/MCP
 * server before the control plane API exists.
 */
export function fakeTransport(seed: {
  instances?: InstanceSummary[];
  keys?: Record<string, InstanceKeys>;
} = {}): HttpTransport {
  const instances: InstanceSummary[] = [...(seed.instances ?? [])];
  const keys: Record<string, InstanceKeys> = { ...(seed.keys ?? {}) };
  let seq = instances.length;
  return {
    async request<T>(method: string, path: string, body?: unknown): Promise<T> {
      const notFound = () => {
        throw new Error(`fakeTransport: no route ${method} ${path}`);
      };
      if (method === 'GET' && path === '/api/status') {
        return { ok: true, version: '0.1.0-fake', instances: instances.length } as T;
      }
      if (method === 'GET' && path === '/api/instances') {
        return instances as T;
      }
      if (method === 'POST' && path === '/api/instances') {
        const input = body as ProvisionInput;
        seq += 1;
        const inst: InstanceSummary = {
          id: `inst_${seq}`,
          name: input.name,
          fqdn: `${input.name}.${input.domain ?? 'invisibledb.io'}`,
          status: 'ready',
          plan: input.plan ?? 'seat',
          createdAt: new Date().toISOString(),
        };
        instances.push(inst);
        return inst as T;
      }
      const keysMatch = path.match(/^\/api\/instances\/([^/]+)\/keys$/);
      if (method === 'GET' && keysMatch) {
        const id = decodeURIComponent(keysMatch[1]);
        const k = keys[id];
        if (!k) return notFound();
        return k as T;
      }
      const queryMatch = path.match(/^\/api\/instances\/([^/]+)\/query$/);
      if (method === 'POST' && queryMatch) {
        const id = decodeURIComponent(queryMatch[1]);
        const q = body as { collection: string; filter?: string; page?: number; perPage?: number };
        return {
          instanceId: id,
          collection: q.collection,
          items: [],
          totalItems: 0,
          page: q.page ?? 1,
          perPage: q.perPage ?? 30,
        } as T;
      }
      const gateMatch = path.match(/^\/api\/instances\/([^/]+)\/gates\/([^/]+)$/);
      if (method === 'GET' && gateMatch) {
        // Fake has no evidence store: honestly UNKNOWN.
        return {
          instanceId: decodeURIComponent(gateMatch[1]),
          gate: decodeURIComponent(gateMatch[2]),
          state: 'UNKNOWN',
          evidence: [],
          checkedAt: new Date().toISOString(),
        } as T;
      }
      return notFound();
    },
  };
}

/** REST-backed client. Maps the interface onto control plane routes. */
export class RestInvisibleDBClient implements InvisibleDBClient {
  constructor(private readonly transport: HttpTransport = stubTransport()) {}

  status(): Promise<ControlPlaneStatus> {
    return this.transport.request('GET', '/api/status');
  }

  list(): Promise<InstanceSummary[]> {
    return this.transport.request('GET', '/api/instances');
  }

  provision(input: ProvisionInput): Promise<InstanceSummary> {
    return this.transport.request('POST', '/api/instances', input);
  }

  keys(instance: string): Promise<InstanceKeys> {
    return this.transport.request(
      'GET',
      `/api/instances/${encodeURIComponent(instance)}/keys`,
    );
  }

  query(
    instance: string,
    collection: string,
    filter?: string,
    opts: QueryOptions = {},
  ): Promise<QueryResult> {
    return this.transport.request(
      'POST',
      `/api/instances/${encodeURIComponent(instance)}/query`,
      { collection, filter, page: opts.page, perPage: opts.perPage },
    );
  }

  gateCheck(instance: string, gate: GateName): Promise<GateCheckResult> {
    return this.transport.request(
      'GET',
      `/api/instances/${encodeURIComponent(instance)}/gates/${encodeURIComponent(gate)}`,
    );
  }
}

/**
 * Build a client from the environment. Reads INVISIBLED_API_URL and
 * INVISIBLED_API_KEY; falls back to the loud stub when unset so misconfig
 * fails fast instead of silently doing nothing.
 */
export function clientFromEnv(): InvisibleDBClient {
  const baseUrl = process.env['INVISIBLED_API_URL'];
  const apiKey = process.env['INVISIBLED_API_KEY'];
  if (baseUrl && apiKey) {
    return new RestInvisibleDBClient(fetchTransport(baseUrl, apiKey));
  }
  return new RestInvisibleDBClient(stubTransport());
}
