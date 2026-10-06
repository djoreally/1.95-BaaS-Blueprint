## SSL and domains: every project gets a real address

### The default (zero marginal cost)

- Control plane calls UAPI to create project.yourdomain.com as a subdomain with its own document root.
- AutoSSL issues the certificate automatically; force HTTPS in the project's .htaccess.
- The proxy rules from [§06](06-ports-reverse-proxy.md) live in that document root. Done — the project has a public, encrypted URL.

### Custom domains (the feature users pay for)

1. User adds a CNAME: app.theirclient.com → project.yourdomain.com.
2. Control plane adds it as an addon/parked domain via UAPI and points the document root at the same folder.
3. AutoSSL covers it once DNS resolves; the control plane polls and reports "secure" only when the cert is actually live — no claiming green without evidence.

### Gotchas

- AutoSSL issuance can lag DNS by minutes to hours; surface "pending" honestly in the UI.
- Wildcard certs are usually unavailable on shared tiers; per-subdomain AutoSSL is the pattern.
- Keep a registry: subdomain ↔ custom domain ↔ project ↔ port. The control plane is the only writer.

## Measured: DNS is the real provisioning dependency (2026-10-05)

`demo.momsoilchange.com` provisioned cleanly via UAPI (subdomain + MySQL + SSL + .htaccess proxy) but was unreachable: public DNS returns **NXDOMAIN** for the subdomain while the apex resolves. Root cause: the domain's authoritative nameservers are **Cloudflare**, not the host — cPanel's automatic zone entries never reach the public internet.

**Rule:** before provisioning, the control plane's preflight must verify the subdomain resolves publicly. Two paths:
1. **Wildcard (recommended for BaaS):** one `*.domain → server IP` A record (DNS-only, grey cloud) at the domain's DNS provider. Every project subdomain then works with zero per-project DNS steps. This is the default the onboarding should push.
2. Per-subdomain A records via the DNS provider's API (Cloudflare token, etc.) — onboarding friction, fallback only.

Note the failure signature for runbooks: TLS handshake succeeds (cert exists via AutoSSL) but HTTP gets empty replies / NXDOMAIN — always check `dns-query` for the FQDN before blaming the proxy rules.
