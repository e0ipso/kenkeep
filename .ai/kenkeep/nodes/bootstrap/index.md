# kenkeep Index: bootstrap

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Bootstrap never overwrites existing nodes**](practice-bootstrap-never-overwrites-existing-nodes.md) to learn about: Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged. #bootstrap #nodes #safety
- Open [**Bootstrap is supervised and judgmental, not exhaustive**](practice-bootstrap-is-supervised-and-judgmental.md) to learn about: /kk-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end. #bootstrap #supervision #sampling
- Open [**Default bootstrap nodes to confidence: medium**](practice-confidence-default-medium-bootstrap.md) to learn about: Bootstrap nodes default to confidence: medium; use high only when the source states the rule with rationale and looks actively maintained. #bootstrap #confidence #calibration

## Components (what exists)
- Open [**/kk-bootstrap skill**](map-kk-bootstrap-skill.md) to learn about: Supervised, agent-driven first-pass bootstrap: surveys docs and writes practice/map nodes under nodes/. Reviewer accepts via git commit. #skill #bootstrap #agent
- Open [**bootstrap-incremental (CLI)**](map-bootstrap-incremental-command.md) to learn about: Headless, hash-aware bootstrap from markdown docs: spawns the harness driver, batches docs in 20s, records SHA-256 in bootstrap-state.json. #cli #bootstrap #deterministic
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](map-bootstrap-state-file.md) to learn about: Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored. #bootstrap #hash #state #schema

## By topic

### #bootstrap
- Open [**/kk-bootstrap skill**](map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap: surveys docs and writes practice/map nodes under nodes/. Reviewer accepts via git commit.
- Open [**bootstrap-incremental (CLI)**](map-bootstrap-incremental-command.md) — Headless, hash-aware bootstrap from markdown docs: spawns the harness driver, batches docs in 20s, records SHA-256 in bootstrap-state.json.
- Open [**Bootstrap never overwrites existing nodes**](practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #agent
- Open [**/kk-bootstrap skill**](map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap: surveys docs and writes practice/map nodes under nodes/. Reviewer accepts via git commit.
### #calibration
- Open [**Curator drops non-productive and change-oriented candidates**](../curation/practice-curator-drops-non-productive-candidates.md) — Change-oriented framing is auto-dropped; hedged, plan-scoped, or low-confidence signatures signal an abandoned-session leak.
- Open [**Default bootstrap nodes to confidence: medium**](practice-confidence-default-medium-bootstrap.md) — Bootstrap nodes default to confidence: medium; use high only when the source states the rule with rationale and looks actively maintained.
### #cli
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #confidence
- Open [**Default bootstrap nodes to confidence: medium**](practice-confidence-default-medium-bootstrap.md) — Bootstrap nodes default to confidence: medium; use high only when the source states the rule with rationale and looks actively maintained.
### #deterministic
- Open [**GRAPH.md**](../index/map-graph-md.md) — Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand.
- Open [**bootstrap-incremental (CLI)**](map-bootstrap-incremental-command.md) — Headless, hash-aware bootstrap from markdown docs: spawns the harness driver, batches docs in 20s, records SHA-256 in bootstrap-state.json.
- Open [**nodes_hash algorithm**](../index/map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #hash
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**nodes_hash algorithm**](../index/map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #nodes
- Open [**Node frontmatter schema**](../node-schema/map-node-frontmatter.md) — OKF-native type/title/description/tags plus kk_-prefixed id, edges, provenance, confidence, and schema version.
- Open [**nodes/ directory and the two kinds**](../node-schema/map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
- Open [**Bootstrap never overwrites existing nodes**](practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #safety
- Open [**Bootstrap never overwrites existing nodes**](practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
- Open [**Pack id collisions skip with a warning**](../pack/practice-pack-id-collisions-skip-with-warning.md) — pack import follows the bootstrap safety rule: a leaf whose id already exists in the consumer repo is skipped and reported, never merged.
### #sampling
- Open [**Bootstrap is supervised and judgmental, not exhaustive**](practice-bootstrap-is-supervised-and-judgmental.md) — /kk-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end.
### #schema
- Open [**Knowledge pack format contract**](../pack/map-knowledge-pack-format.md) — A pack root has kenkeep-pack.yaml, README.md, knowledge/; PackManifestSchema validates the manifest; knowledge/ is a nodes/-shaped tree.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
### #skill
- Open [**curate (CLI command + /kk-curate skill)**](../curation/map-curate-command.md) — Runs the curator on processed session logs, applying add/modify/contradict/drop actions to nodes/. /kk-curate is the in-session equivalent.
- Open [**/kk-bootstrap skill**](map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap: surveys docs and writes practice/map nodes under nodes/. Reviewer accepts via git commit.
### #state
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**Session log (_sessions/*.md)**](../state/map-session-log.md) — Per-session checkpoint _sessions/<YYYYMMDD-HHmm-id>.md, one per session_id; frontmatter tracks capture, proposal, and curator phases.
### #supervision
- Open [**Bootstrap is supervised and judgmental, not exhaustive**](practice-bootstrap-is-supervised-and-judgmental.md) — /kk-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end.