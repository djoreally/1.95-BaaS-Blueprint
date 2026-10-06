## One binary per project: the PocketBase pattern

### Install (per project, over jailed SSH)

```bash
mkdir -p ~/apps/myapp && cd ~/apps/myapp
# Download the Linux amd64 release from pocketbase.io (verify checksum)
./pocketbase serve --http=127.0.0.1:8091 --dir=./pb_data
# Create the admin once: ./pocketbase superuser upsert admin@you.com ***
```

Bind to `127.0.0.1` only. The binary is never exposed directly; Apache is the only public door ([§06](06-ports-reverse-proxy.md)).

### What one binary gives each project

Included

- Email/password + OAuth auth
- Collections = tables with REST API
- Realtime subscriptions (SSE-based)
- File storage on disk
- Admin UI at /_/
- JS hooks for custom logic

You add

- Per-project subdomain + SSL (Sec. 09)
- Watchdog + log rotation (Sec. 07)
- Litestream replication (Sec. 12)
- Disk quota discipline (folder per project)

### When the binary will not survive

Some hosts kill detached processes within minutes. The preflight ([§17](17-build-roadmap.md)) tests this with a 24-hour sleeper before you build on it. Fallbacks, in order:

- cPanel Node.js selector / Passenger: a small Express or Hono app providing auth (JWT) + REST over SQLite/MySQL. Less BaaS surface, fully sanctioned lifecycle — Passenger restarts it and the host supervises it.
- PHP runtime: the host's native tongue; a Slim/Laravel-lite API is unglamorous and nearly unkillable on shared hosting.
- Move that tenant to reseller ([§14](14-control-plane.md)) where account-level limits are yours to set.
