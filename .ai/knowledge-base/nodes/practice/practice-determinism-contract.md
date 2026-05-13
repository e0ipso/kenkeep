---
schema_version: 1
id: practice-determinism-contract
title: "INDEX/GRAPH and nodes_hash are deterministic and content-addressed"
kind: practice
tags: [determinism, hashing, index, graph, testing]
derived_from:
  - docs/internals/architecture.md
  - docs/internals/schemas.md
relates_to: [map-index-and-graph-files, map-nodes-directory]
depends_on: []
confidence: high
summary: "computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, and ensureUniqueId are pure. crypto.randomUUID() is the only randomness, scoped to run_id minting."
---

# INDEX/GRAPH and nodes_hash are deterministic and content-addressed

- `computeNodesHash` is content-addressed and mtime-independent.
- `generateIndex` / `generateGraph` are pure functions of `nodes/` plus an injected `now`.
- `slugify`, `deriveNodeId`, and `ensureUniqueId` are pure.
- `crypto.randomUUID()` is the only source of randomness, scoped to `run_id` minting.

Tests rely on this. See `tests/lib/index-gen.test.ts` for golden-file comparisons. If you change anything that touches index/graph rendering or node-id derivation, treat the test failures as the spec: either the change is wrong or you must update the golden files in the same commit.

The `nodes_hash` algorithm: walk every `.md` under `nodes/`, hash each file's contents with SHA-256, build `<relative-path>\t<sha256-hex>` strings, sort lexicographically, join with `\n`, then SHA-256 the joined string.
