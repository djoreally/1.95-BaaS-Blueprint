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
