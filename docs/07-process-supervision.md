## Supervision without systemd: the cron watchdog

You cannot have systemd. You can have 95% of what you actually used it for: start on boot-equivalent, restart on crash, and a log you can read.

### The pattern (per project)

```
~/apps/myapp/
  pocketbase            # binary
  pb_data/              # data + storage
  start.sh              # idempotent launcher (nohup, pidfile)
  watchdog.sh           # "if pid dead, run start.sh"
  logs/app.log
```

```bash
#!/bin/sh
# start.sh — safe to run repeatedly
cd "$HOME/apps/myapp"
if [ -f app.pid ] && kill -0 "$(cat app.pid)" 2>/dev/null; then exit 0; fi
nohup ./pocketbase serve --http=127.0.0.1:8091 --dir=./pb_data \
  >> logs/app.log 2>&1 &
echo $! > app.pid
```

```
# crontab — the entire supervisor
* * * * * $HOME/apps/myapp/watchdog.sh
30 3 * * * find $HOME/apps/myapp/logs -name "*.log" -size +10M -delete
```

### What this gives up vs systemd — honestly

| systemd | Cron watchdog equivalent |
| --- | --- |
| Instant restart | Up to one cron interval of downtime (usually 1 min) |
| Dependency ordering | Start order in watchdog script; keep it simple |
| journald | Plain log files + rotation ([§03](03-phase-0-resource-diet.md)) |
| Resource limits | CloudLinux LVE already enforces account limits |

For side projects at ten to twenty users, a one-minute worst-case restart is a fair trade for a $1.95 substrate. Say so in the product copy; do not oversell five-nines on shared hosting.
