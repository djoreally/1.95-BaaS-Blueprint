## Ports and proxying: Apache is your ingress

### Port allocation

Keep a registry — a plain table in the control plane — so projects never collide. Planning pattern on a single account:

| Range | Use |
| --- | --- |
| 8091–8099 | PocketBase instances (one per project) |
| 8100–8199 | Node/Passenger-adjacent custom apps |
| 8200+ | Reserved: control plane internals, Litestream metrics |

### The .htaccess proxy (subdomain document root)

```
# ~/public_html/myapp/.htaccess  (mod_proxy + mod_rewrite hosts)
RewriteEngine On
RewriteCond %{REQUEST_URI} ^/api/.* [OR]
RewriteCond %{REQUEST_URI} ^/_/.*
RewriteRule ^(.*)$ http://127.0.0.1:8091/$1 [P,L,QSA]
# WebSocket/SSE: PocketBase realtime uses SSE over HTTP,
# which survives this proxy; true WebSockets need
# mod_proxy_wstunnel and many shared hosts disable it —
# verify in preflight, degrade to polling if absent.
```

If `mod_proxy` is unavailable (some hosts disable the `[P]` flag), the fallback is cPanel's Node selector for the app itself, or a tiny PHP reverse-proxy shim as a last resort — functional, slower, and a signal to prefer reseller ([§14](14-control-plane.md)) where you control the package features.

### Rules that keep you sane

- Never bind a project binary to a public interface; loopback only.
- One subdomain per project, always — path-based multi-tenancy (/myapp/) breaks PocketBase asset and API URLs.
- Record port ↔ project ↔ subdomain in one place; the control plane owns this registry.
