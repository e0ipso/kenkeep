---
type: map
title: nodes_hash algorithm
description: >-
  Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined
  in computeNodesHash (src/lib/nodes.ts).
tags:
  - hash
  - deterministic
  - sha256
kk_schema_version: 3
kk_id: map-nodes-hash
kk_derived_from:
  - docs/internals/schemas.md
  - docs/internals/architecture.md
kk_relates_to:
  - map-entry-md
  - map-graph-md
  - practice-determinism-contract
kk_depends_on: []
kk_confidence: high
---

# `nodes_hash` algorithm

Deterministic, content-addressed, mtime-independent. Defined in `computeNodesHash` (`src/lib/nodes.ts`).

Steps:

1. Walk all `.md` files under `nodes/`.
2. For each, compute `sha256(contents)`.
3. Build strings: `<relative-path>\t<sha256-hex>`.
4. Sort lexicographically.
5. Join with `\n`.
6. `nodes_hash = sha256(joined)`.

The hash is embedded in the frontmatter of `ENTRY.md` and `GRAPH.md`. Comparing the recorded hash against a fresh recompute is how `doctor` and `kk-session-start.mjs` detect that the indices have drifted from `nodes/`.

Tests rely on this determinism — see `tests/lib/index-gen.test.ts` for golden-file comparisons.

<!-- kk:related:start -->
# Related

- Related: [map-entry-md](/index/map-entry-md.md)
- Related: [map-graph-md](/index/map-graph-md.md)
- Related: [practice-determinism-contract](/index/practice-determinism-contract.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/schemas.md](docs/internals/schemas.md)
[2] [docs/internals/architecture.md](docs/internals/architecture.md)
<!-- kk:citations:end -->
