## Reference kit and preflight checklist

### Canonical layout (per project, any tier)

```
~/apps/<project>/  pocketbase (+ .prev)  pb_data/ (data.db + storage/)
  start.sh  watchdog.sh  deploy.sh  litestream.yml  logs/app.log
~/public_html/<project-subdomain>/
  .htaccess           # proxy to 127.0.0.1:<port>
  index.html          # frontend build output (if any)
```

### Preflight — run before building on any new host

- SSH (jailed) works; uname -m, free disk, cron minimum interval recorded
- A test binary survives 24h detached — or Passenger fallback confirmed
- mod_proxy [P] flag works from .htaccess — or Node selector path confirmed
- AutoSSL issues for a fresh test subdomain; time-to-cert measured
- Outbound HTTPS to R2/B2 works; Litestream test replication restored successfully
- UAPI token created and a subdomain created/deleted via API
- (Reseller) WHM API token works; test account created and removed
- DB version recorded; vector path chosen (sqlite-vec) + 100-vector test timed
- LVE limits read and recorded — the numbers you will budget against

### Assumptions this blueprint makes (verify, do not trust)

PocketBase idle memory (30–60 MB), Micro practical ceiling (5–8 light projects), and AutoSSL behavior are planning estimates, not measurements of your account — Week 1 replaces them with observed numbers. OrangeHost plan details as of October 5, 2026. Re-confirm pricing before any public claim.

BaaS Blueprint — Tyreese Burton, October 2026. Reference: OrangeHost Micro (momsoilchange.com).
