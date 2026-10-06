## Architecture at a glance: cPanel is the substrate

Five layers. Only the top one is software you write; the other four are features the host already runs.

1 Control Plane

Your product.

Web UI + API: create project, set env vars, view logs, attach domain, trigger deploy. Stores project metadata in its own PocketBase/MySQL.

You build this

2 Provisioning

cPanel

UAPI

(subdomains, MySQL, cron, SSL, Node apps) on a single account;

WHM API

(create/suspend accounts, packages) on reseller. All scriptable over HTTPS with API tokens.

Host provides

3 Runtime

One

single binary per project

— PocketBase (Go) by default; alternatives: Appwrite is too heavy, Supabase needs Docker/Postgres, a small Node app via the cPanel Node selector is the fallback. SQLite on disk, files on disk.

PocketBase

4 Proxy / Edge

Apache + LiteSpeed in front.

.htaccess

with mod_proxy/mod_rewrite routes

project.yourdomain.com

to

127.0.0.1:

<

port

>

. AutoSSL terminates HTTPS. WebSocket/SSE caveats in [§06](06-ports-reverse-proxy.md).

5 Data / Backup

SQLite files per project, replicated continuously by

Litestream

to Cloudflare R2 or Backblaze B2 free tiers. MySQL available when a workload truly needs it ([§10](10-auth-files-data.md)). Vector embeddings live beside the data — sqlite-vec by default, MySQL options in [§11](11-vector-rag.md).

### Request flow

```
Browser → AutoSSL (443) → Apache vhost (subdomain)
  → .htaccess ProxyPass → 127.0.0.1:8091 (PocketBase)
  → SQLite (WAL) + pb_data/storage (uploaded files)
  → Litestream → R2/B2 (offsite, continuous)
```

### Why PocketBase first

One static Go binary (~25 MB) delivers authentication (email/password, OAuth), collections as REST + realtime API, file storage, an admin dashboard, and cron hooks — roughly 80% of Supabase's surface with none of its moving parts. It idles at 30–60 MB RAM in planning estimates, which is the only reason the 1 GB tier works at all. If a host kills arbitrary binaries, the same architecture falls back to a Node app under Passenger ([§05](05-single-binary-apps.md)).
 — Phase 0
