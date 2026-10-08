# InvisibleDB VPS runbook — Ubuntu 24.04 production runtime

This box runs the hosted product: one isolated PocketBase/SQLite container per
customer behind Caddy and the InvisibleDB gateway. Customer data stays in Docker
volumes; the control plane lives on Vercel/Neon.

## 0. Box

InterServer Cloud VPS, Ubuntu 24.04. DNS points `*.invisibledb.app` at the box.

## 1. Harden once

```bash
mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd

ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
apt-get update && apt-get install -y unattended-upgrades fail2ban rsync git
dpkg-reconfigure -plow unattended-upgrades
```

## 2. Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker "$SUDO_USER"
```

## 3. Initial deploy

```bash
mkdir -p /srv/idb
rsync -a deploy/vps/ /srv/idb/
cd /srv/idb
cp .env.example .env
# Fill BASE_DOMAIN, ACME_EMAIL, CONTROL_PLANE_URL, VPS_API_SECRET.
chmod +x bin/*

docker compose up -d --build
docker build -f pocketbase/Dockerfile.vec -t idb-pocketbase:vec pocketbase
```

The vec image is the default tenant runtime. It contains PocketBase plus
sqlite-vec and the InvisibleDB vector API contract.

## 4. Provision a customer

```bash
/srv/idb/bin/provision acme-corp founder@acme.com
```

Provisioning creates:

- `idb-acme-corp` container with isolated SQLite volume
- Caddy route + automatic TLS
- `idb_live_...` server key in `/srv/idb/keys/acme-corp.key` (0600)
- PocketBase superuser credential in `/srv/idb/keys/acme-corp.admin` (0600)

The instance server key is for trusted server/control-plane traffic only. Web and
mobile applications authenticate normal PocketBase end users and rely on
collection API rules; they do **not** embed the instance key.

## 5. Scheduled jobs

```cron
# /etc/cron.d/idb-backup
0 2 * * * root /srv/idb/bin/backup >/var/log/idb-backup.log 2>&1

# Optional off-box copy.
15 2 * * * root rsync -a --delete /srv/idb/backups/ orangehost:/home/<user>/idb-backups/

# /etc/cron.d/idb-poll — provisioning + runtime command worker
*/2 * * * * root /srv/idb/bin/poll-provision >>/var/log/idb-poll.log 2>&1

# /etc/cron.d/idb-health
*/5 * * * * root /srv/idb/bin/check-health
```

## 6. Upgrade an existing production box

Sync the new `deploy/vps/` tree, preserving `.env`, keys, backups, Caddy state and
customer Docker volumes, then run the upgrade script:

```bash
cd /path/to/1.95-BaaS-Blueprint
git fetch origin
git checkout feat/runtime-control-plane
sudo rsync -a --exclude='.env' deploy/vps/ /srv/idb/
sudo chmod +x /srv/idb/bin/*
sudo /srv/idb/bin/upgrade-runtime
```

`upgrade-runtime` is rollback-safe:

1. builds `idb-pocketbase:vec`
2. rebuilds the gateway
3. takes a safety backup per tenant
4. recreates each PocketBase container against the **same volume**
5. health-checks the new runtime
6. automatically falls back to `idb-pocketbase:latest` if the new tenant runtime fails

No customer data volume is deleted by this process.

## 7. Gateway credential lanes

The gateway intentionally has two modes:

- `Authorization: Bearer idb_live_...` matching the tenant key: privileged server
  lane; gateway swaps it for a PocketBase superuser token.
- no token or a normal PocketBase user token: public/end-user lane; request passes
  to PocketBase unchanged and collection rules enforce access.

Management-only paths such as PocketBase superusers/settings/backups and vector
index maintenance are blocked from the public lane.

`GET https://<slug>.invisibledb.app/` returns instance metadata, not an admin UI.

## 8. Runtime control channel

The VPS polls both:

- `/api/vps/requests` — provision/deprovision
- `/api/vps/commands` — status, usage, logs, backup, restore, restart, key sync/rotation

The control plane stores latest telemetry in `InstanceState` and command/audit
history in `RuntimeCommand`. Tenant management keys are AES-256-GCM encrypted in
`InstanceCredential`; they are never serialized to browser JavaScript.

## 9. Backups and restore

`bin/backup` creates online SQLite snapshots with second-level timestamps. The
control panel can request Backup Now and guarded Restore. Restore:

1. creates a fresh safety snapshot
2. validates the selected SQLite backup
3. stops the tenant container
4. replaces only `/pb/data/data.db`
5. restarts the tenant
6. runs a second integrity check

## 10. Monitoring

```bash
docker ps
curl -fsS http://localhost:8080/healthz
/srv/idb/bin/check-health
tail -f /var/log/idb-poll.log
```

The customer control panel reports container health, CPU/RAM, volume/database
size, TLS reachability, latest backup, logs, vector capability and key state.
