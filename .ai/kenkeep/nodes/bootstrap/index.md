---
schema_version: 2
nodes_hash: 'sha256:b166136534632c1b21ec488f887cb102bdb8297431ec9ebf1d0afc3d7f52cf08'
node_count: 6
---
# kenkeep Index: bootstrap

_6 node(s) in this folder • ~2108 estimated tokens_

## Subfolders
_None._

## Conventions (how we build)
- **Bootstrap never overwrites existing nodes** [`bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md`] Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged. #bootstrap #nodes #safety
- **Bootstrap is supervised and judgmental, not exhaustive** [`bootstrap/practice-bootstrap-is-supervised-and-judgmental.md`] /kk-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end. #bootstrap #supervision #sampling
- **Default bootstrap nodes to confidence: medium** [`bootstrap/practice-confidence-default-medium-bootstrap.md`] Bootstrap nodes default to confidence: medium; use high only when the source doc states the rule with rationale and looks actively maintained. #bootstrap #confidence #calibration

## Components (what exists)
- **bootstrap-incremental (CLI)** [`bootstrap/map-bootstrap-incremental-command.md`] Headless, hash-aware bootstrap from existing markdown docs. Spawns the harness headless driver, batches docs in 20s, records SHA-256 in bootstrap-state.json. #cli #bootstrap #deterministic
- **/kk-bootstrap skill** [`bootstrap/map-kk-bootstrap-skill.md`] Supervised, agent-driven first-pass bootstrap. Surveys docs, writes practice/map nodes directly under nodes/. Reviewer accepts via git commit. #skill #bootstrap #agent
- **.state/bootstrap-state.json (per-doc hash cache)** [`bootstrap/map-bootstrap-state-file.md`] Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored. #bootstrap #hash #state #schema

## By topic

- **#bootstrap (6):** bootstrap-incremental (CLI), /kk-bootstrap skill, .state/bootstrap-state.json (per-doc hash cache), Bootstrap never overwrites existing nodes, Bootstrap is supervised and judgmental, not exhaustive, Default bootstrap nodes to confidence: medium
- **#agent (1):** /kk-bootstrap skill
- **#calibration (1):** Default bootstrap nodes to confidence: medium
- **#cli (1):** bootstrap-incremental (CLI)
- **#confidence (1):** Default bootstrap nodes to confidence: medium
- **#deterministic (1):** bootstrap-incremental (CLI)
- **#hash (1):** .state/bootstrap-state.json (per-doc hash cache)
- **#nodes (1):** Bootstrap never overwrites existing nodes
- **#safety (1):** Bootstrap never overwrites existing nodes
- **#sampling (1):** Bootstrap is supervised and judgmental, not exhaustive
- **#schema (1):** .state/bootstrap-state.json (per-doc hash cache)
- **#skill (1):** /kk-bootstrap skill
- **#state (1):** .state/bootstrap-state.json (per-doc hash cache)
- **#supervision (1):** Bootstrap is supervised and judgmental, not exhaustive
