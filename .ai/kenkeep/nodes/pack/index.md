---
schema_version: 2
nodes_hash: 'sha256:bfc352062f79d2116f913af0b00bbf8a759416255706e55ee1598841fed05647'
node_count: 4
summary: 'Knowledge pack import, export, manifest, and safety rules.'
---
# kenkeep Index: pack

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Pack export stamps schema_version from NODE_SCHEMA_VERSION**](practice-pack-export-stamps-schema-version.md) to learn about: pack export builds the manifest in code and always sets schema_version from NODE_SCHEMA_VERSION before validating it with PackManifestSchema. #pack #export #schema
- Open [**Pack id collisions skip with a warning**](practice-pack-id-collisions-skip-with-warning.md) to learn about: pack import follows the bootstrap safety rule: a leaf whose id already exists in the consumer repo is skipped, reported, and never merged or overwritten. #pack #import #nodes #safety
- Open [**Pack import is deterministic and leaves rebalance for later**](practice-pack-import-is-deterministic.md) to learn about: pack import validates and grafts reviewed markdown without an LLM, keeps the pack under one nodes/<name>/ branch, rebuilds indexes, and leaves structural rebalance to the later curate phase. #pack #import #determinism #rebalance

## Components (what exists)
- Open [**Knowledge pack format contract**](map-knowledge-pack-format.md) to learn about: A knowledge pack root carries kenkeep-pack.yaml, README.md, and knowledge/; the manifest is validated by PackManifestSchema and knowledge/ is a nodes/ shaped markdown tree. #pack #schema #cli

## By topic

### #pack
- Open [**Knowledge pack format contract**](map-knowledge-pack-format.md) — A knowledge pack root carries kenkeep-pack.yaml, README.md, and knowledge/; the manifest is validated by PackManifestSchema and knowledge/ is a nodes/ shaped markdown tree.
- Open [**Pack export stamps schema_version from NODE_SCHEMA_VERSION**](practice-pack-export-stamps-schema-version.md) — pack export builds the manifest in code and always sets schema_version from NODE_SCHEMA_VERSION before validating it with PackManifestSchema.
- Open [**Pack id collisions skip with a warning**](practice-pack-id-collisions-skip-with-warning.md) — pack import follows the bootstrap safety rule: a leaf whose id already exists in the consumer repo is skipped, reported, and never merged or overwritten.
### #import
- Open [**Pack id collisions skip with a warning**](practice-pack-id-collisions-skip-with-warning.md) — pack import follows the bootstrap safety rule: a leaf whose id already exists in the consumer repo is skipped, reported, and never merged or overwritten.
- Open [**Pack import is deterministic and leaves rebalance for later**](practice-pack-import-is-deterministic.md) — pack import validates and grafts reviewed markdown without an LLM, keeps the pack under one nodes/<name>/ branch, rebuilds indexes, and leaves structural rebalance to the later curate phase.
### #schema
- Open [**Knowledge pack format contract**](map-knowledge-pack-format.md) — A knowledge pack root carries kenkeep-pack.yaml, README.md, and knowledge/; the manifest is validated by PackManifestSchema and knowledge/ is a nodes/ shaped markdown tree.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — Schema migrations are handled by one generic migrate command that detects the current schema and dispatches the appropriate step, not by separate commands per bump.
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state. Carries only last_nudged_at; the proposal-drain lock is a sidecar proper-lockfile directory (60s stale, auto-reclaimed), not a JSON field.
### #cli
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — Schema migrations are handled by one generic migrate command that detects the current schema and dispatches the appropriate step, not by separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #determinism
- Open [**Determinism contract for ENTRY/GRAPH generation**](../index/practice-determinism-contract.md) — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, ensureUniqueId are pure functions. Only randomness is crypto.randomUUID() for run_id.
- Open [**Pack import is deterministic and leaves rebalance for later**](practice-pack-import-is-deterministic.md) — pack import validates and grafts reviewed markdown without an LLM, keeps the pack under one nodes/<name>/ branch, rebuilds indexes, and leaves structural rebalance to the later curate phase.
### #export
- Open [**Pack export stamps schema_version from NODE_SCHEMA_VERSION**](practice-pack-export-stamps-schema-version.md) — pack export builds the manifest in code and always sets schema_version from NODE_SCHEMA_VERSION before validating it with PackManifestSchema.
### #nodes
- Open [**Node frontmatter schema**](../node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**nodes/ directory and the two kinds**](../node-schema/map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
- Open [**Bootstrap never overwrites existing nodes**](../bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #rebalance
- Open [**Pack import is deterministic and leaves rebalance for later**](practice-pack-import-is-deterministic.md) — pack import validates and grafts reviewed markdown without an LLM, keeps the pack under one nodes/<name>/ branch, rebuilds indexes, and leaves structural rebalance to the later curate phase.
### #safety
- Open [**Bootstrap never overwrites existing nodes**](../bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
- Open [**Pack id collisions skip with a warning**](practice-pack-id-collisions-skip-with-warning.md) — pack import follows the bootstrap safety rule: a leaf whose id already exists in the consumer repo is skipped, reported, and never merged or overwritten.
