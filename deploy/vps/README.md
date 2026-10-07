# InvisibleDB VPS runbook — fresh Ubuntu 24.04 to serving customers

This is the box that runs the hosted product: one PocketBase container per
customer behind Caddy with automatic TLS. Read top to bottom on first setup;
after that you only need `bin/provision`.

## 0. Order the box (Tyreese)

InterServer → Cloud VPS → 1 slice (1 vCPU, 2 GB RAM, 40 GB SSD, $3/mo,
price-locked). OS: Ubuntu 24.04. Region: Secaucus NJ. Note the root IP.

## 1. Harden (run as root, once)

```bash
# SSH key only, no passwords
mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys   # paste Tyreese's pubkey
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl reload sshd

# Firewall: only web + ssh
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable

# Auto security updates + fail2ban
apt-get update && apt-get install -y unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades
```

## 2. Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker "$SUDO_USER"   # or your deploy user
```

## 3. Deploy this directory to /srv/idb

```bash
mkdir -p /srv/idb && rsync -a deploy/vps/ /srv/idb/
cd /srv/idb
cp .env.example .env   # fill in BASE_DOMAIN + ACME_EMAIL
chmod +x bin/*
docker compose up -d          # Caddy comes up; sites/ is empty, that's fine
docker build -t idb-pocketbase:latest ./pocketbase
```

DNS: wildcard `*.BASE_DOMAIN` → box IP (or per-customer A records).

## 4. Provision a customer

```bash
/srv/idb/bin/provision acme-corp founder@acme.com
# → https://acme-corp.invisibledb.app live with TLS in ~60s, API key in /srv/idb/keys/
```

## 5. Backups (host cron, once)

```cron
# /etc/cron.d/idb-backup — nightly dumps, 02:00
0 2 * * * root /srv/idb/bin/backup >/var/log/idb-backup.log 2>&1
# off-box copy (keys for the OrangeHost box live in /root/.ssh):
15 2 * * * root rsync -a --delete /srv/idb/backups/ orangehost:/home/<user>/idb-backups/
```

## 6. Monitoring

- `docker ps` — every `idb-*` container must be `Up`; Caddy reloads are zero-downtime.
- Disk: each customer is capped at 256 MB RAM; watch `/var/lib/docker` volume growth.
- Uptime: point any uptime checker at `https://<slug>.BASE_DOMAIN/api/health`.

## Limits (by design, Phase 1)

- No auth gateway yet (Phase 2): Caddy proxies straight to PocketBase. The box
  stays private / unlisted until the gateway lands — do not send customers here.
- No sqlite-vec yet (Phase 3): the Dockerfile is structured for a custom build swap.
- Backups are local + rsync; object storage (B2) is the Phase 4 upgrade.
