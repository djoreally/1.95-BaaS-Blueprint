/**
 * TLS helper for talking to cPanel.
 *
 * cPanel ships self-signed certificates, so the platform cannot use the
 * default fetch for :2083. This wrapper uses node:https with
 * rejectUnauthorized:false — scoped ONLY to calls the control plane makes
 * to the hosting API, never to public traffic.
 */
import https from 'node:https';

export function insecureFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const u = new URL(raw);
    const body = init?.body as string | undefined;
    const headers: Record<string, string> = { ...((init?.headers as Record<string, string>) ?? {}) };
    if (body) headers['content-length'] = String(Buffer.byteLength(body));
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port ? parseInt(u.port, 10) : 443,
        path: `${u.pathname}${u.search}`,
        method: init?.method ?? 'GET',
        headers,
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(text),
            text: async () => text,
          } as Response);
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(60_000, () => req.destroy(new Error('request timeout')));
    if (body) req.write(body);
    req.end();
  });
}
