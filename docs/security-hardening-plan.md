# InvisibleDB Security Hardening

This document tracks the production hardening baseline for InvisibleDB.

## P0 before broader production use

- Per-tenant Docker bridge network; customer PocketBase containers never share a tenant network.
- Gateway remains on the shared edge network for Caddy, and is dynamically attached to each tenant network.
- Caddy injects an internal edge secret; the gateway rejects non-health traffic that did not come through the trusted edge.
- PocketBase tenant containers run with `no-new-privileges` and all Linux capabilities dropped.
- Gateway request body and rate controls are enforced before proxying to PocketBase.
- Backup directories and snapshots are owner-only (`0700` / `0600`).
- Runtime migration is fail-safe: tenant data volumes are never deleted and shared-network disconnect happens only after the isolated path passes a health check.

## P1

- Encrypt backups at rest with a dedicated backup key kept outside the tenant volume.
- Verify off-box backup delivery and perform scheduled restore drills.
- Host firewall: only SSH, HTTP and HTTPS exposed publicly.
- SSH key-only administration using a non-root sudo account; disable password authentication and direct root login after access is verified.
- fail2ban (or equivalent) and unattended security updates.
- Central append-only security/audit events and alerting.
- Secret rotation procedures for edge secret, instance keys, control-plane encryption key and PocketBase superuser credentials.

## P2

- External vulnerability scanning and dependency/container image scanning.
- Restore-time objectives and disaster-recovery exercises.
- Per-tenant quotas and anomaly detection.
- Independent penetration test before high-value or regulated workloads.
