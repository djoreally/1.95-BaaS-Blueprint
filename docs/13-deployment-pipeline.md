## Push-to-deploy without a CI runner on the box

### The lightweight pipeline

1. Build elsewhere: GitHub Actions (free tier) or the developer's machine builds the frontend and any binary artifacts. The shared box never runs a build — it has 1 CPU and better things to do.
2. Deliver: webhook or a "Deploy" button in the control plane triggers git pull in the project directory over SSH, or unpacks an uploaded artifact.
3. Swap safely: for PocketBase upgrades, stop → replace binary → start → health-check /api/health; keep the previous binary as pocketbase.prev for one-command rollback.
4. Frontend: static builds rsync into the subdomain document root; the proxy rules stay untouched.

```bash
# deploy.sh (sketch)
set -e
cd "$HOME/apps/myapp"
curl -sf http://127.0.0.1:8091/api/health || ./start.sh
# ... pull, swap, restart via watchdog, re-check health,
# and roll back to pocketbase.prev if the check fails
```

Git is available on the Micro tier, so `git pull` deploys work today. The control plane's job is orchestration and reporting — commit SHA, timestamp, health result — stored per deploy so "what is live?" is always answerable.
