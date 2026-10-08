## Supervision without systemd: Docker restart policies + cron

You do not need systemd to supervise customer processes — Docker does the watching now. The supervisor is `restart: unless-stopped` in the compose file and in `bin/provision`, plus healthchecks that actually run. Cron is no longer the watchdog; it is the scheduler for two jobs: the 02:00 backup and the 2-minute provision poller.

### The pattern (on the VPS)

```
caddy / gateway / idb-<slug>   →  restart: unless-stopped, healthchecked
/etc/cron.d/idb-backup         →  0 2 * * * root /srv/idb/bin/backup
/etc/cron.d/idb-poll           →  */2 * * * * root /srv/idb/bin/poll-provision
```

Every per-customer container is launched by `bin/provision` with `--restart unless-stopped --memory 256m --memory-swap 256m --pids-limit 128`. The infrastructure containers declare the same policy in `docker-compose.yml`. A crashed customer process is restarted by the Docker daemon in seconds — no one-minute cron interval of downtime, no pidfiles, no `kill -0` polling.

### Healthchecks: the lesson that cost a deploy (2026-10-07)

The gateway Dockerfile had this:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8080/healthz || exit 1
```

on a `node:20-alpine` base — which ships **no `wget`**. Every healthcheck failed; the container was permanently `unhealthy`. Fix: `RUN apk add --no-cache wget` in the build, same as the PocketBase image. **Rule:** never trust a healthcheck command you have not watched succeed. `docker inspect <name> | grep -A3 Health` is part of every deploy verification, not an optional extra.

### What Docker supervision gives up vs systemd — honestly

| systemd | Docker restart policy equivalent |
| --- | --- |
| Instant, dependency-ordered restart | Restart in seconds, but **no ordering** — Caddy can come up before a customer container exists |
| journald | `docker logs` (json-file driver — set `max-size`/`max-file` log rotation or the disk fills; see [§16](16-resource-budgets-limits.md)) |
| Resource limits (cgroups via unit files) | Native: `--memory`, `--memory-swap`, `--pids-limit` on every customer container |
| `systemctl status` | `docker ps` — every `idb-*` container must read `Up` |

On full box reboot: Docker itself is started by the host systemd, then all `unless-stopped` containers come back. Ordering is not guaranteed, but it does not need to be — Caddy retries `reverse_proxy` upstreams, and a customer container that starts after Caddy is routed to within seconds. Verify this claim the way you verify everything: reboot the box, watch `docker ps`, curl a customer subdomain.

### What cron still does

Two jobs, both in `/etc/cron.d/`, both idempotent and safe to re-run:

- **Provision poller** (`*/2`): pulls `ProvisionRequest` rows from the control plane (`CONTROL_PLANE_URL/api/vps/requests`, authenticated by `VPS_API_SECRET` from `/srv/idb/.env`), runs `bin/provision`/`bin/deprovision`, reports the result back. The box never talks to Stripe — billing lives on the control plane ([§14](14-control-plane.md)).
- **Backup** (`0 2 * * *`): `bin/backup` — per-customer SQLite dumps, see [§12](12-backups-maintenance.md). Log to `/var/log/idb-backup.log`; if the log is empty one morning, that is a signal, not silence.

The difference from the old world is the split: **Docker watches processes; cron fires jobs.** A cron watchdog that restarts processes is a workaround for shared hosting. On your own box, use the supervisor you actually have.
