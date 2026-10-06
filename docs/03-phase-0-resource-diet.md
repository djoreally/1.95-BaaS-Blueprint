## Free the box first: the storage and resource diet

Your reference Micro account sits at 2.5 of 5 GB. Target: under 1.5 GB before the first project lands. Every gigabyte freed is headroom a project will not have to fight for.

### Where the weight usually is

| Culprit | How to find it | Diet move |
| --- | --- | --- |
| Error/access logs | `du -sh ~/logs ~/public_html/error_log` | Truncate, then cap (below) |
| Old backups in home dir | `ls -lh ~/backup* *.tar.gz` | Download once, delete from box; backups belong offsite |
| node_modules in deployed apps | `du -sh ~/public_html/*/node_modules` | Build locally/CI, deploy artifacts only |
| Email mailboxes | cPanel → Email → Disk Usage | Forward-and-delete or archive; mail is not free storage |
| Staging copies / .git | `du -sh ~/public_html/*/.git` | One canonical deploy dir per project |
| cPanel trash + tmp | `du -sh ~/.trash ~/tmp` | Empty monthly via cron |

### Caps that stay on forever

```
# Log rotation without root: weekly cron, keep 7 days, max 10 MB
find ~/logs ~/apps/*/logs -name "*.log" -size +10M -mtime +7 -delete
# SQLite hygiene per project (in the watchdog, [§07](07-process-supervision.md))
sqlite3 pb_data/data.db "PRAGMA wal_checkpoint(TRUNCATE); VACUUM;"
# PocketBase log cap: --logMaxSizeMB is not a flag; rotate via cron above
# Trash + tmp sweep
find ~/.trash ~/tmp -type f -mtime +14 -delete
```

### WAL discipline

PocketBase/SQLite in WAL mode creates a `-wal` file that grows with write bursts. The checkpoint above, run nightly, keeps it bounded. Never copy a live database without its WAL; Litestream ([§12](12-backups-maintenance.md)) handles this correctly — manual `cp` of `data.db` alone does not.

### Exit criteria for Phase 0

Disk under 30% used • log rotation cron installed • one offsite backup of the current account downloaded • inventory of everything currently hosted written down (if it is not inventoried, it is not migrated — it is deleted deliberately or kept deliberately).
