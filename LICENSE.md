# License

This repository uses a split license, matching the product's structure:
the recipe is open, the experience is the business.

| Path | License | Why |
|---|---|---|
| `packages/adapter-cpanel/` | Apache 2.0 | The cPanel/WHM integration recipe — maximally reusable, hosts and tools can embed it freely. |
| `packages/supervisor/` | Apache 2.0 | The on-box supervision kit — same reasoning. |
| `apps/control-plane/` | AGPLv3 | The product experience. Anyone who runs a modified version as a network service must share their modifications (AGPLv3 §13). This protects the hosted-platform model. |
| `docs/` (blueprint) | CC BY 4.0 (intent) | The spec itself is shared knowledge; confirm before republishing commercially. |

Each licensed directory carries its full license text in its own `LICENSE` file and an SPDX identifier in `package.json`. If a file doesn't say otherwise, the license of its directory applies.
