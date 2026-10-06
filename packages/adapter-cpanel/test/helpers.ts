/**
 * Mock fetch for adapter tests. Routes are keyed as:
 *   "UAPI:<Module>/<func>"  or  "WHM:<func>"
 * A route value is either the `data` payload to return, or a failure marker:
 *   { __uapiError: "msg" }  → UAPI envelope with status 0
 *   { __whmError: "reason" } → WHM envelope with result 0
 *   { __http: 500 }          → transport-level HTTP failure
 */
export interface RecordedCall {
  kind: 'uapi' | 'whm';
  module: string;
  func: string;
  params: Record<string, string>;
  headers: Record<string, string>;
}

type RouteValue = unknown;

export interface MockFetch {
  fetch: typeof fetch;
  calls: RecordedCall[];
  /** shorthand: ["SubDomain/addsubdomain", "Mysql/create_database", ...] */
  callKeys: () => string[];
}

function isFailureMarker(v: unknown): v is { __uapiError: string } | { __whmError: string } | { __http: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    ('__uapiError' in v || '__whmError' in v || '__http' in v)
  );
}

export function createMockFetch(routes: Record<string, RouteValue> = {}): MockFetch {
  const calls: RecordedCall[] = [];

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const urlStr = String(url);
    const u = new URL(urlStr);
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers as Record<string, string> | undefined;
    if (rawHeaders) for (const [k, v] of Object.entries(rawHeaders)) headers[k.toLowerCase()] = String(v);

    let kind: 'uapi' | 'whm';
    let module = '';
    let func = '';
    let params: Record<string, string> = {};

    if (u.pathname.includes('/execute/')) {
      kind = 'uapi';
      const parts = u.pathname.split('/execute/')[1].split('/');
      module = parts[0];
      func = parts[1];
      params = Object.fromEntries(new URLSearchParams(String(init?.body ?? '')).entries());
    } else if (u.pathname.includes('/json-api/')) {
      kind = 'whm';
      func = u.pathname.split('/json-api/')[1];
      params = Object.fromEntries(u.searchParams.entries());
      delete params['api.version'];
    } else {
      throw new Error(`mockFetch: unrecognized URL ${urlStr}`);
    }

    calls.push({ kind, module, func, params, headers });

    const key = kind === 'uapi' ? `UAPI:${module}/${func}` : `WHM:${func}`;
    const route = key in routes ? routes[key] : undefined;

    const jsonResponse = (body: unknown, status = 200): Response =>
      ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      }) as Response;

    if (isFailureMarker(route)) {
      if ('__http' in route) return jsonResponse({ error: 'transport' }, route.__http as number);
      if ('__uapiError' in route)
        return jsonResponse({ status: 0, errors: [(route as { __uapiError: string }).__uapiError], data: null });
      return jsonResponse({
        metadata: { result: 0, reason: (route as { __whmError: string }).__whmError },
        data: null,
      });
    }

    const data = route === undefined ? defaultData(kind, module, func) : route;
    if (kind === 'uapi') return jsonResponse({ status: 1, errors: null, data });
    return jsonResponse({ metadata: { result: 1 }, data });
  }) as typeof fetch;

  return {
    fetch: fetchImpl,
    calls,
    callKeys: () => calls.map((c) => (c.kind === 'uapi' ? `UAPI:${c.module}/${c.func}` : `WHM:${c.func}`)),
  };
}

/** Sensible defaults so happy-path tests only declare what they care about. */
function defaultData(kind: 'uapi' | 'whm', module: string, func: string): unknown {
  if (kind === 'whm') {
    if (func === 'version') return { version: '11.138.0.11' };
    if (func === 'listaccts') return { acct: [] };
    return {};
  }
  if (module === 'SSL' && func === 'list_certs') return [];
  if (module === 'Cron' && func === 'list_lines') return [];
  return {};
}

export const UAPI_ERROR = (msg: string) => ({ __uapiError: msg });
export const WHM_ERROR = (reason: string) => ({ __whmError: reason });
export const HTTP_FAIL = (status: number) => ({ __http: status });

/** A fetch impl that explodes if called — proves dry-run issues zero requests. */
export function explodingFetch(): typeof fetch {
  return ((_url: unknown) => {
    throw new Error('fetch must not be called in dry-run mode');
  }) as typeof fetch;
}
