---
schema_version: 2
nodes_hash: 'sha256:dc4d7df6cad8315154c7c530c347498d8ccdec61c63b15e2a05cfac9852e1fcf'
node_count: 4
---
# kenkeep Index: knowledge-base / index

_4 node(s) in this folder • ~1315 estimated tokens_

## Subfolders
_None._

## Conventions (how we build)
- **Determinism contract for ENTRY/GRAPH generation** [`knowledge-base/index/practice-determinism-contract.md`] computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id. #determinism #indexing #testing

## Components (what exists)
- **ENTRY.md** [`knowledge-base/index/map-entry-md.md`] Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/. #entry #index #deterministic #sessionstart
- **GRAPH.md** [`knowledge-base/index/map-graph-md.md`] Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand. #graph #deterministic
- **nodes_hash algorithm** [`knowledge-base/index/map-nodes-hash.md`] Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts). #hash #deterministic #sha256

## By topic

- **#deterministic (3):** ENTRY.md, GRAPH.md, nodes_hash algorithm
- **#determinism (1):** Determinism contract for ENTRY/GRAPH generation
- **#entry (1):** ENTRY.md
- **#graph (1):** GRAPH.md
- **#hash (1):** nodes_hash algorithm
- **#index (1):** ENTRY.md
- **#indexing (1):** Determinism contract for ENTRY/GRAPH generation
- **#sessionstart (1):** ENTRY.md
- **#sha256 (1):** nodes_hash algorithm
- **#testing (1):** Determinism contract for ENTRY/GRAPH generation
