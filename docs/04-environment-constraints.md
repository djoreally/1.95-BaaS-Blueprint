## Design around the cage: shared-hosting constraints

| Constraint | Reality on cPanel shared | Design answer |
| --- | --- | --- |
| No root, no systemd | You cannot install services | Cron watchdog + start scripts (Sec. 07) |
| No Docker | Hard no, not a maybe | Single binaries + Node selector (Sec. 05) |
| CloudLinux LVE limits | CPU/RAM/IO/entry-process caps per account; hitting them = 508 errors | Memory budget (Sec. 08); reseller isolates per tenant (Sec. 14) |
| No Postgres (this tier) | Micro lists MySQL only | SQLite primary; MySQL when justified (Sec. 10) |
| Process killers | Some hosts reap long-running background processes | Preflight test (Sec. 17); Passenger fallback |
| Shared IP / Apache front | You do not bind 80/443 | High ports + .htaccess proxy (Sec. 06) |
| Cron granularity | Often 1-minute minimum, sometimes 15 | Watchdog interval = host minimum; design for it |
| Outbound restrictions | SMTP often relay-only; some ports blocked | Transactional email via API (Resend-style), backups via HTTPS to R2/B2 |

### The mindset shift

On a VPS you ask "what can I install?" On shared hosting you ask "what is already running that I can orchestrate?" Apache, MySQL, cron, SSL issuance, DNS, and the Node runtime are all managed for you — that managed-ness is the product's leverage, not its limitation. Your control plane is an orchestrator of host features, exactly as Coolify is an orchestrator of Docker.

## Measured on OrangeHost Micro (2026-10-05) — Week 1 verdict: GO

PocketBase v0.36.5 downloaded (12.1 MB), extracted, and served on 127.0.0.1:8091:
- `GET /api/health` → **HTTP 200**
- Idle RSS: **27,744 KB (~27 MB)** — far under the 150 MB budget; ~6 instances fit comfortably in 1 GB with headroom for the supervisor and spikes.

Substrate confirmed:
- Disk: account dirs total ~1.6 GB of quota; host 2 TB at 50% (host-wide figure).
- MySQL **8.0.43** (Community) — JSON fallback path confirmed, no native VECTOR (not 9.0).
- PHP 8.1.34 (cli), Node v16.20.2, Python 3.6.8.
- Shell limits generous: open files 1,048,576; max user processes unlimited; virtual memory unlimited. (Host-wide CPU/mem figures — 12 cores / 78 GB — are the node, not the LVE slice.)
- PostgreSQL ruled out separately (see docs/11-vector-rag.md): installed but fenced off, no usable connection path.

Survival re-check 2026-10-05 ~22:19 EDT (9.5 min elapsed): same PID, health HTTP 200, RSS steady at ~26 MB (26,420 KB vs 27,744 KB at start — no leak). CloudLinux does not reap it in the short term; the 2-minute watchdog covers the long term regardless.
