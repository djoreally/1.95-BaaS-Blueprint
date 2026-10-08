## Keep the $3 box healthy first: VPS resource hygiene

Your InterServer slice is cheap and price-locked — but it is small, and it is one box. Target: comfortable headroom at 10 customers, graceful behavior at 50. Every megabyte freed is a customer you do not have to buy hardware for.

### Where the weight usually is

| Culprit | How to find it | Diet move |
| --- | --- | --- |
| Docker image layers | `docker system df` | `docker image prune -a --filter "until=720h"` on a monthly cron; keep only the tags you run |
| Build cache | `docker builder du` | `docker builder prune -f --filter "until=168h"` weekly — builds leave gigabytes behind |
| Stopped containers + dangling volumes | `docker ps -a`, `docker volume ls -f dangling=true` | Prune weekly; a deprovisioned customer must leave nothing (`bin/deprovision` owns this) |
| Container logs (json-file) | `du -sh /var/lib/docker/containers/*/*-json.log` | Log rotation in compose: `logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }` on every service |
| Customer volumes | `du -sh /srv/idb/volumes/*` per slug | Per-customer quota policy: warn at 80%, soft-cap at the plan tier; SQLite stays small, `pb_data/storage` does not |
| Stale backups | `ls -lh /srv/idb/backups/` | Retention: 7 daily + 4 weekly; offsite copy before deleting local ([§12](12-backups-maintenance.md)) |
| System logs | `journalctl --disk-usage` | Cap: `journalctl --vacuum-size=200M` monthly via cron |

### Caps that stay on forever

```bash
# Docker hygiene (weekly cron on the VPS)
docker image prune -a -f --filter "until=720h"
docker builder prune -f --filter "until=168h"
docker volume prune -f
# SQLite hygiene per customer (inside each container's data dir, nightly)
sqlite3 pb_data/data.db "PRAGMA wal_checkpoint(TRUNCATE); VACUUM;"
# Backup retention (daily cron): keep 7 daily + 4 weekly
find /srv/idb/backups -name "*.db" -mtime +30 -delete
# Journal vacuum (monthly)
journalctl --vacuum-size=200M
```

### WAL discipline

PocketBase/SQLite in WAL mode creates a `-wal` file that grows with write bursts. The checkpoint above, run nightly per customer volume, keeps it bounded. Never copy a live database without its WAL; `bin/backup` uses SQLite's online-backup path (or quiesces the container's writes briefly) so snapshots are consistent — manual `cp` of `data.db` alone does not give you a restorable file.

### Exit criteria for Phase 0

Docker disk under 40% used • log rotation on every compose service • backup cron + retention cron installed • `docker system df` breakdown written down per customer (if a volume is not measured, it is not billed — measure first, cap second).

### Why this matters more on the $3 box than anywhere else

On a $20 VPS you notice bloat in the invoice. On a $3 slice you notice it in an outage. Disk-full on a single box is a platform-wide event: every customer's container dies at once. The Phase 0 diet is not housekeeping — it is the difference between "cheap and reliable" and "cheap and embarrassing." No evidence, no green: re-run `docker system df` after every diet step and record the before/after.
