/**
 * Wildcard DNS check via Cloudflare DNS-over-HTTPS.
 *
 * For a BaaS, every project gets its own subdomain — asking the customer to
 * add a DNS record per project is onboarding friction. The preflight probes
 * a random unguessable name: if it resolves, a `*.domain` wildcard exists
 * and provisioning can proceed with zero per-project DNS steps.
 */
export interface DnsCheck {
  ok: boolean;
  detail: string;
}

export async function checkWildcardDns(domain: string): Promise<DnsCheck> {
  const slug = `baas-preflight-${Math.random().toString(36).slice(2, 10)}`;
  const name = `${slug}.${domain}`;
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=A`,
      { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) return { ok: false, detail: `DoH lookup failed (HTTP ${res.status})` };
    const j = (await res.json()) as {
      Status: number;
      Answer?: Array<{ type: number; data: string }>;
    };
    const a = (j.Answer ?? []).filter((r) => r.type === 1);
    if (a.length > 0) {
      return { ok: true, detail: `*.${domain} resolves → ${a[0].data}` };
    }
    return {
      ok: false,
      detail: `No wildcard found. Add an A record for *.${domain} at your DNS provider (DNS-only, not proxied) — one record, then every project subdomain works.`,
    };
  } catch (e) {
    return { ok: false, detail: `DNS check failed: ${(e as Error).message}` };
  }
}
