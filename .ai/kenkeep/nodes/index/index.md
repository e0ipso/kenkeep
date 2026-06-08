---
schema_version: 2
nodes_hash: 'sha256:e7a17aa6ec8e40462bff2c7c6bbc9cfc211ab40f6e47916519df77b571142249'
node_count: 4
summary: >-
  the deterministic ENTRY.md and GRAPH.md indexes and the nodes_hash that drives
  their regeneration
---
# kenkeep Index: index

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Determinism contract for ENTRY/GRAPH generation**](index/practice-determinism-contract.md) to learn about: computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id. #determinism #indexing #testing

## Components (what exists)
- Open [**ENTRY.md**](index/map-entry-md.md) to learn about: Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/. #entry #index #deterministic #sessionstart
- Open [**GRAPH.md**](index/map-graph-md.md) to learn about: Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand. #graph #deterministic
- Open [**nodes_hash algorithm**](index/map-nodes-hash.md) to learn about: Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts). #hash #deterministic #sha256

## By topic

### #deterministic
- Open [**GRAPH.md**](index/map-graph-md.md) — Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand.
- Open [**bootstrap-incremental (CLI)**](bootstrap/map-bootstrap-incremental-command.md) — Headless, hash-aware bootstrap from existing markdown docs. Spawns the harness headless driver, batches docs in 20s, records SHA-256 in bootstrap-state.json.
- Open [**nodes_hash algorithm**](index/map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #determinism
- Open [**Determinism contract for ENTRY/GRAPH generation**](index/practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
### #entry
- Open [**ENTRY.md**](index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
### #graph
- Open [**GRAPH.md**](index/map-graph-md.md) — Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand.
### #hash
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**nodes_hash algorithm**](index/map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #index
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**ENTRY.md**](index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
### #indexing
- Open [**Determinism contract for ENTRY/GRAPH generation**](index/practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
### #sessionstart
- Open [**ENTRY.md**](index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
- Open [**kk-session-start.mjs (consume hook)**](hooks/map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
### #sha256
- Open [**nodes_hash algorithm**](index/map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #testing
- Open [**Determinism contract for ENTRY/GRAPH generation**](index/practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
- Open [**Testing philosophy: few tests, mostly integration**](conventions/practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
