## SSL and domains: every customer gets a real address

### The default (zero marginal cost)

- Wildcard DNS: `*.invisibledb.app → 66.23.224.55` (**DNS-only, grey cloud**) at the domain's DNS provider. One record, every customer subdomain works.
- `bin/provision` writes `caddy/sites/<slug>.caddy` and reloads Caddy:

```
<slug>.invisibledb.app {
	reverse_proxy gateway:8080
}
```

- Caddy obtains a Let's Encrypt certificate for the hostname automatically and renews it forever. The reverse-proxy idea from [§06](06-ports-reverse-proxy.md) now lives in that one block, not in `.htaccess`. TLS is live within ~60 seconds of provisioning — measured, not promised.
- The gateway sits between Caddy and the customer's container and validates `Authorization: Bearer <apiKey>` before proxying by Host header ([§10](10-auth-files-data.md)).

### Custom domains (the feature users pay for)

1. User adds a CNAME: `app.theirclient.com → <slug>.invisibledb.app`.
2. Control plane stores the mapping in its domain registry ([§14](14-control-plane.md)).
3. Caddy **on-demand TLS** issues the cert for the custom hostname automatically — no config edit, no reload, no per-domain dance. The dashboard reports "secure" only when the certificate is actually live — no claiming green without evidence.

### Gotchas

- Grey cloud is load-bearing: Cloudflare proxying (orange cloud) would break Let's Encrypt HTTP-01 validation and hide the origin. DNS-only at the provider, always.
- Keep a registry: subdomain ↔ custom domain ↔ customer ↔ container ↔ API key. The control plane is the only writer; `bin/provision` and `bin/deprovision` are its hands on the box.

## Measured: DNS is the real provisioning dependency (2026-10-07)

`demo.invisibledb.app` provisioned cleanly — container up, Caddy route written, reload green — but was unreachable: public DNS returned **NXDOMAIN** because the wildcard record had not propagated yet. Root cause: nothing on the box. The Caddyfile was correct, the container was healthy, Let's Encrypt could not complete because the hostname did not publicly exist.

**Rule:** before provisioning, preflight must verify the hostname resolves publicly, and after `bin/provision`, the health check is DNS first, TLS second, HTTP third. The failure signature to remember for runbooks: `docker ps` all `Up`, Caddy reloaded, TLS handshake never completes or the LE issuance queue backs up — always run `dig +short <slug>.invisibledb.app` before blaming Caddy.

The old-world version of this lesson was a Cloudflare-nameservered apex where cPanel's zone entries never reached the public internet. The substrate changed; the lesson did not: **the network outside the box is the provisioning dependency you do not control.**
