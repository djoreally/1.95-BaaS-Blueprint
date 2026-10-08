## Many customers, $3: the one-container-per-customer pattern

### The decision: shared instance, or one container per customer? — decided

|  | One shared PocketBase, many customers | **One container + one volume per customer (chosen)** |
| --- | --- | --- |
| RAM | Lowest (single 30–60 MB idle) | Linear per customer, hard-capped at 256 MB each |
| Isolation | None — one crash, one bad query, one noisy customer takes everyone | Strong — blast radius is one customer; Docker enforces it |
| Backups | All-or-nothing restore | Per-customer `bin/backup` streams; restore one customer without touching the rest |
| Auth | One leaked admin token compromises everyone | One API key opens exactly one customer's gateway route |
| Upgrades | All customers move PocketBase versions together | `:latest` vs `:vec` image per customer, swap when ready |
| Verdict | Rejected — it is the shared-hosting trap we left | **Default.** This is the product pattern |

The shared instance is not just weaker isolation — it is a pricing-model lie. We sell each customer *their own database file*. Per-customer containers make the marketing claim and the architecture the same thing. Do not let the margin math talk you back into sharing.

### Memory budget (planning estimates — measure in preflight)

| Consumer | Estimate |
| --- | --- |
| Host baseline: Ubuntu + Docker daemon + Caddy + gateway | ~400–600 MB (reserved, untouchable) |
| PocketBase idle, per customer | 30–60 MB |
| PocketBase under light load | 60–120 MB |
| Hard cap per customer (`--memory 256m`, enforced by Docker) | 256 MB — a runaway customer OOMs alone |
| Gateway request overhead | Negligible (single-key swap, no per-request state) |
| 40 GB SSD: per-customer volume growth | Watch `/var/lib/docker`; the 02:00 backup is the tripwire ([§12](12-backups-maintenance.md)) |
| **Practical $3-box ceiling** | **~8–12 paying customers** with headroom; 15+ if most are idle |

The 256 MB cap is doing two jobs: it protects the box from one bad customer, and it *defines the product*. A customer outgrowing their envelope is an upsell conversation (bigger box), not an incident.

### The rule

Customer #13 on the $3 box is not a failure of discipline; it is the signal to rent a bigger slice. The scale path is **bigger VPS → multi-VPS** ([§15](15-reseller-tier.md) runs the margin math): the control plane's `ProvisionRequest` gains a `vps_id`, and `bin/poll-provision` runs unchanged on every box. Nothing about the per-customer container changes — that is the point of making the unit of scale one container.

What breaks first, and the move for each, is tracked in [§16](16-resource-budgets-limits.md). Do not pre-build multi-VPS orchestration; build it when the first box's headroom is honestly gone.
