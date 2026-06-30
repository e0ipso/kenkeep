---
schema_version: 2
nodes_hash: 'sha256:2506f3ff0fde6020138743711bfc9cd2857d8fe09018760d764b3ba77f1344f3'
node_count: 5
summary: >-
  the deterministic ENTRY/GRAPH/index generation and nodes_hash; read when
  touching index generation or staleness checks
---
# kenkeep Index: index

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Determinism contract for ENTRY/GRAPH generation**](practice-determinism-contract.md) to learn about: computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id. #determinism #indexing #testing
- Open [**Keep ENTRY.md lean and bounded — no topic map**](practice-keep-entry-md-lean-and-bounded-no-topic-map.md) to learn about: The top-level entry catalog (ENTRY.md) stays intentionally lean and bounded, containing no global topic map. #kenkeep #entry #index #design

## Components (what exists)
- Open [**ENTRY.md**](map-entry-md.md) to learn about: Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/. #entry #index #deterministic #sessionstart
- Open [**GRAPH.md**](map-graph-md.md) to learn about: Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand. #graph #deterministic
- Open [**nodes_hash algorithm**](map-nodes-hash.md) to learn about: Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts). #hash #deterministic #sha256

## By topic

### #deterministic
- Open [**GRAPH.md**](map-graph-md.md) — Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand.
- Open [**bootstrap-incremental (CLI)**](../bootstrap/map-bootstrap-incremental-command.md) — Headless, hash-aware bootstrap from existing markdown docs. Spawns the harness headless driver, batches docs in 20s, records SHA-256 in bootstrap-state.json.
- Open [**nodes_hash algorithm**](map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #entry
- Open [**ENTRY.md**](map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
- Open [**Keep ENTRY.md lean and bounded — no topic map**](practice-keep-entry-md-lean-and-bounded-no-topic-map.md) — The top-level entry catalog (ENTRY.md) stays intentionally lean and bounded, containing no global topic map.
### #index
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](../cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](../cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**ENTRY.md**](map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
### #design
- Open [**Keep ENTRY.md lean and bounded — no topic map**](practice-keep-entry-md-lean-and-bounded-no-topic-map.md) — The top-level entry catalog (ENTRY.md) stays intentionally lean and bounded, containing no global topic map.
### #determinism
- Open [**Determinism contract for ENTRY/GRAPH generation**](practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
- Open [**Pack import is deterministic and leaves rebalance for later**](../pack/practice-pack-import-is-deterministic.md) — pack import validates and grafts reviewed markdown without an LLM, keeps the pack under one nodes/<name>/ branch, rebuilds indexes, and leaves structural rebalance to the later curate phase.
### #graph
- Open [**GRAPH.md**](map-graph-md.md) — Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand.
### #hash
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](../bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**nodes_hash algorithm**](map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #indexing
- Open [**Determinism contract for ENTRY/GRAPH generation**](practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
### #kenkeep
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
- Open [**Curate CLI conflict output names the three resolution outcomes**](../curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
### #sessionstart
- Open [**ENTRY.md**](map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
- Open [**kk-session-start.mjs (consume hook)**](../hooks/map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
### #sha256
- Open [**nodes_hash algorithm**](map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #testing
- Open [**Determinism contract for ENTRY/GRAPH generation**](practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
- Open [**Testing philosophy: few tests, mostly integration**](../conventions/practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
- Open [**Add hermetic end-to-end capture tests per harness**](../hooks/practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
