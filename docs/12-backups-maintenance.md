## Backups you can restore: Litestream to free object storage

A backup you have never restored is a hope, not a backup. This recipe is continuous, offsite, and costs $0 at side-project scale.

### The recipe

```yaml
# litestream.yml (per project)
dbs:
  - path: /home/USER/apps/myapp/pb_data/data.db
    replicas:
      - type: s3
        bucket: myapp-backups
        path: myapp
        endpoint: https://ACCOUNT_ID.r2.cloudflarestorage.com
        sync-interval: 10s
```

- Cloudflare R2 free tier or Backblaze B2 free tier — either works; keys scoped to one bucket per project.
- Litestream ships WAL segments continuously, so restore point objective is seconds, not last night.
- Nightly, also snapshot pb_data/storage (uploaded files) with rclone to the same bucket — Litestream covers the database only.
- Retain 30 days; test-restore monthly into a scratch subdomain and record the result.

### Restore drill (the part everyone skips)

```sql
litestream restore -o /tmp/restore-test.db s3://myapp-backups/myapp
sqlite3 /tmp/restore-test.db "PRAGMA integrity_check; SELECT count(*) FROM _admins;"
```

### Productize it

The control plane shows each project a last-replicated timestamp pulled from Litestream's status — a "backed up 12s ago" line in the dashboard is a trust feature competitors on free tiers do not show. Claim it only from the live timestamp, never from the cron schedule.
