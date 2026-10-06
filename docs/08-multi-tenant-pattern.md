## Many projects, 1 GB: the Micro multi-project pattern

### The decision: one shared PocketBase, or one per project?

|  | One shared instance, many collections | One instance per project |
| --- | --- | --- |
| RAM | Lowest (single 30–60 MB) | Scales linearly per project |
| Isolation | Weak — one crash takes all projects | Strong — blast radius is one project |
| Backups | All-or-nothing restore | Per-project Litestream streams |
| Verdict | Only for your own throwaway tools | **Default.** This is the product pattern |

### Memory budget (planning estimates — measure in preflight)

| Consumer | Estimate |
| --- | --- |
| cPanel/Apache/MySQL baseline (host-managed, shared) | Outside your 1 GB app view, but LVE counts your processes |
| PocketBase idle, per project | 30–60 MB |
| PocketBase under light load | 60–120 MB |
| Litestream, per database | 10–20 MB |
| Control plane (if self-hosted on the box) | 40–80 MB — or host it elsewhere (see Sec. 13) |
| **Practical Micro ceiling** | **5–8 light projects** per 1 GB account, with headroom |

### The rule

Project #9 is not a failure of discipline; it is the signal to graduate to the Reseller Tier ([§14](14-control-plane.md)), where each project stops sharing one 1 GB ceiling. Micro is the proving ground, not the ceiling of the business.
