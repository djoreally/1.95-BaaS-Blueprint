## Limits, failure modes, and customer data portability

The VPS **is** the substrate now — there is no "VPS escape hatch" because there is nothing to escape from. What this section tracks is what breaks first on the $3 slice and the exact move for each, plus the portability promise that survives every architecture.

### What breaks first on the $3/mo box

| What breaks first | Symptom | Move |
| --- | --- | --- |
| RAM per customer container | OOM kills, containers restarting, gateway 502s | Per-container memory limits keep one tenant from eating the box; then a bigger slice ([§15](15-reseller-tier.md), stage 2) |
| Disk (volumes + backups) | Write failures, backup jobs dying | Retention policy on `/srv/idb/backups` + off-box rsync stays the source of truth; local backups are a convenience, not the archive |
| SQLite write contention | Lock timeouts under write bursts | Same as ever: the busy workload moves to a bigger box or out of SQLite — but the default workload (indie apps, agent memory) fits SQLite with room to spare |
| Single-box failure domain | One dead box = all customers dark | Multi-box stage; until then, the restore drill is the SLA: fresh box + off-box backups = customers back |
| TLS issuance at scale | Caddy rate-limited by Let's Encrypt on a burst of new subdomains | Stagger provisioning; one wildcard cert is the standing option if per-subdomain issuance ever binds |
| Traffic spike | CPU saturation on 1 vCPU | Cache at Caddy; the spike is also the revenue signal that funds stage 2 |

### Customer data portability is the product

**The escape hatch is a feature, and it is still literally true.** Every customer is one container and one SQLite file at `/srv/idb/<slug>-data`. Leaving is a download, not a negotiation: export the volume, hand over `data.db`, and their entire database — schema, rows, auth, files, vector embeddings — is a file they own. The deprovision path itself proves it: `bin/deprovision` takes a final backup *before* removing the container, so even cancellation ends with the customer holding their data.

Market it the way it was always meant to be marketed: "start at $1, leave whenever, your database is a file you can download." The Firebase bill is the fear; the hostage dynamic is the insult this product removes. No evidence of a restore, no claim of portability — the drill (provision → write data → export → restore on a fresh volume → verify) is run and logged before any marketing copy mentions it.
