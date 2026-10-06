## Limits, failure modes, and the escape hatch

| What breaks first | Symptom | Move |
| --- | --- | --- |
| RAM on Micro | 508s, killed processes | Graduate tenant to Spark account (Sec. 15) |
| Disk (uploads) | Quota errors, failed writes | Object storage for media, per-account quotas |
| SQLite write contention | Lock timeouts under bursts | MySQL for that workload, or VPS tier |
| WebSocket-dependent app | Realtime silently degrades | SSE/polling, or VPS — do not promise WS on shared |
| Host kills binaries | Watchdog restart loops | Passenger/PHP fallback; change host or tier |
| Traffic spike | LVE entry-process caps | Cache aggressively; this is the VPS graduation trigger |

**The escape hatch is a feature.** Because every project is a folder, a SQLite file, and a Litestream stream, exporting a tenant to a VPS (real Coolify, real Docker) is a restore-and-repoint operation. Market it that way: "start at $9, leave whenever, your data is a file you can download." Customer ownership of data is the anti-hostage pitch, and here it is literally true.
