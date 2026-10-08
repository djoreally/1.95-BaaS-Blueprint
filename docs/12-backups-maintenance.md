## Backups you can restore: nightly SQLite dumps, off-box copy

A backup you have never restored is a hope, not a backup. On this substrate the recipe is honest about its RPO: **last night, not last second** — continuous Litestream replication is the Phase 4 upgrade; what runs today is a 02:00 cron dump plus an off-box copy, both real and both verifiable.

### The recipe

`/etc/cron.d/idb-backup` → `0 2 * * * root /srv/idb/bin/backup >/var/log/idb-backup.log 2>&1`

For every running `idb-<slug>` container, `bin/backup`:

1. Runs `sqlite3 /pb/data/data.db ".backup '/tmp/<name>-<date>.db'"` **inside the container** — online, no downtime, WAL handled correctly (never `cp` a live database file).
2. `docker cp`s the dump to `/srv/idb/backups/<slug>-<date>.db.gz` and compresses it.
3. Enforces retention: newest 11 files per customer (≈ 7 daily + 4 weekly).

Then the off-box copy, fifteen minutes later:

```cron
# /etc/cron.d/idb-backup — off-box copy, 02:15
15 2 * * * root rsync -a --delete /srv/idb/backups/ <offsite-host>:/idb-backups/
```

Two copies, two machines, one cron line each. The restore point objective is last night's 02:00 dump — say so in the product copy; do not oversell continuous replication until Phase 4 ships it.

**Known gap, stated plainly:** `bin/backup` covers `data.db`. Uploaded files live in the same customer volume (`/pb/data/storage`) but are not part of the `.backup` — they need a volume-level copy, which is the open item the Phase 4 object-storage upgrade closes. The dashboard must never claim files are backed up until that path exists and is drill-tested.

### Restore drill (the part everyone skips)

Monthly, per customer, into a scratch container — not into production:

```bash
gunzip -c /srv/idb/backups/acme-2026-10-08.db.gz > /tmp/restore-test.db
sqlite3 /tmp/restore-test.db "PRAGMA integrity_check; SELECT count(*) FROM _admins;"
# then: restore the file into a throwaway idb-restore-test container,
# boot it, and click through the customer's app against it.
```

Record the result with the date. A drill that passes is evidence; a drill that fails is the cheapest incident you will ever have.

### Productize it

The control plane shows each customer a last-backup timestamp pulled from the real file in `/srv/idb/backups/` — a "backed up 6h ago" line in the dashboard is a trust feature competitors on free tiers do not show. Claim it only from the live file mtime, never from the cron schedule. If the 02:00 cron silently stops, the dashboard timestamp goes stale — that staleness is itself the alert, which is why the timestamp is computed from evidence, not from the crontab.
