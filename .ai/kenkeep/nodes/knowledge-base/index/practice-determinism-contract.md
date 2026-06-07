---
schema_version: 2
id: practice-determinism-contract
title: Determinism contract for ENTRY/GRAPH generation
kind: practice
tags:
  - determinism
  - indexing
  - testing
derived_from:
  - docs/internals/architecture.md
relates_to:
  - map-nodes-hash
  - map-entry-md
  - map-graph-md
depends_on: []
confidence: high
summary: >-
  computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId,
  ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for
  run_id.
---

# Determinism contract for ENTRY/GRAPH generation

The package depends on a strict determinism contract for everything that touches `nodes/`, `ENTRY.md`, and `GRAPH.md`:

- `computeNodesHash` is content-addressed and mtime-independent.
- `generateIndex` and `generateGraph` are pure functions of `nodes/` plus an injected `now`.
- `slugify`, `deriveNodeId`, and `ensureUniqueId` are pure.
- `crypto.randomUUID()` is the only randomness in the system, and it is scoped to minting `run_id` values.

**Why:** the same `nodes/` tree must produce byte-identical `ENTRY.md` and `GRAPH.md` no matter who runs the regeneration or when. This is what makes the pre-commit hook (`index rebuild --stage`) safe to run from a contributor's machine, and what makes the `doctor` and `kk-session-start.mjs` freshness check meaningful (`nodes_hash` drift is real, not a clock or filesystem artifact). Tests rely on this — `tests/lib/index-gen.test.ts` does golden-file comparisons.

**How to apply:**

- Never introduce `Date.now()` or non-injected `new Date()` into the index/graph generators. Inject `now` via the same parameter the existing call sites use.
- No `Math.random()` anywhere in the data path. If you genuinely need randomness, route it through `crypto.randomUUID()` and scope it to a single id mint.
- No filesystem mtime reads in `computeNodesHash` or anything that contributes to `nodes_hash`. Hashing is by content.
