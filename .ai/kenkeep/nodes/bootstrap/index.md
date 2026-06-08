---
schema_version: 2
nodes_hash: 'sha256:9f0004ed0a4b64748b9cc4e9352d9279769213fcac965deeec8d3b24cfe29b22'
node_count: 6
summary: >-
  seeding the knowledge base from existing docs via /kk-bootstrap and the
  bootstrap-incremental command
---
# kenkeep Index: bootstrap

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Bootstrap never overwrites existing nodes**](bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) to learn about: Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged. #bootstrap #nodes #safety
- Open [**Bootstrap is supervised and judgmental, not exhaustive**](bootstrap/practice-bootstrap-is-supervised-and-judgmental.md) to learn about: /kk-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end. #bootstrap #supervision #sampling
- Open [**Default bootstrap nodes to confidence: medium**](bootstrap/practice-confidence-default-medium-bootstrap.md) to learn about: Bootstrap nodes default to confidence: medium; use high only when the source doc states the rule with rationale and looks actively maintained. #bootstrap #confidence #calibration

## Components (what exists)
- Open [**bootstrap-incremental (CLI)**](bootstrap/map-bootstrap-incremental-command.md) to learn about: Headless, hash-aware bootstrap from existing markdown docs. Spawns the harness headless driver, batches docs in 20s, records SHA-256 in bootstrap-state.json. #cli #bootstrap #deterministic
- Open [**/kk-bootstrap skill**](bootstrap/map-kk-bootstrap-skill.md) to learn about: Supervised, agent-driven first-pass bootstrap. Surveys docs, writes practice/map nodes directly under nodes/. Reviewer accepts via git commit. #skill #bootstrap #agent
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](bootstrap/map-bootstrap-state-file.md) to learn about: Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored. #bootstrap #hash #state #schema

## By topic

### #bootstrap
- Open [**bootstrap-incremental (CLI)**](bootstrap/map-bootstrap-incremental-command.md) — Headless, hash-aware bootstrap from existing markdown docs. Spawns the harness headless driver, batches docs in 20s, records SHA-256 in bootstrap-state.json.
- Open [**/kk-bootstrap skill**](bootstrap/map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap. Surveys docs, writes practice/map nodes directly under nodes/. Reviewer accepts via git commit.
- Open [**Bootstrap never overwrites existing nodes**](bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #agent
- Open [**/kk-bootstrap skill**](bootstrap/map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap. Surveys docs, writes practice/map nodes directly under nodes/. Reviewer accepts via git commit.
### #calibration
- Open [**Curator drops non-productive and change-oriented candidates**](curation/practice-curator-drops-non-productive-candidates.md) — Change-oriented framing (migration stories) is auto-dropped. Hedged/plan-scoped/low-confidence-without-rationale signatures are evidence of an abandoned-session leak.
- Open [**Default bootstrap nodes to confidence: medium**](bootstrap/practice-confidence-default-medium-bootstrap.md) — Bootstrap nodes default to confidence: medium; use high only when the source doc states the rule with rationale and looks actively maintained.
### #cli
- Open [**Curate CLI conflict output names the three resolution outcomes**](curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**curate CLI conflict-resolution output message**](curation/map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
- Open [**curate (CLI command + /kk-curate skill)**](curation/map-curate-command.md) — Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent.
### #confidence
- Open [**Default bootstrap nodes to confidence: medium**](bootstrap/practice-confidence-default-medium-bootstrap.md) — Bootstrap nodes default to confidence: medium; use high only when the source doc states the rule with rationale and looks actively maintained.
### #deterministic
- Open [**GRAPH.md**](index/map-graph-md.md) — Full edge listing derived from every node's relates_to and depends_on. Not injected; harness reads on demand.
- Open [**bootstrap-incremental (CLI)**](bootstrap/map-bootstrap-incremental-command.md) — Headless, hash-aware bootstrap from existing markdown docs. Spawns the harness headless driver, batches docs in 20s, records SHA-256 in bootstrap-state.json.
- Open [**nodes_hash algorithm**](index/map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #hash
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**nodes_hash algorithm**](index/map-nodes-hash.md) — Content-addressed, mtime-independent SHA-256 hash of the nodes/ tree. Defined in computeNodesHash (src/lib/nodes.ts).
### #nodes
- Open [**Node frontmatter schema**](node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**nodes/ directory and the two kinds**](node-schema/map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
- Open [**Bootstrap never overwrites existing nodes**](bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #safety
- Open [**Bootstrap never overwrites existing nodes**](bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #sampling
- Open [**Bootstrap is supervised and judgmental, not exhaustive**](bootstrap/practice-bootstrap-is-supervised-and-judgmental.md) — /kk-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end.
### #schema
- Open [**.state/state.json (lock + nudge state)**](state/map-state-file.md) — Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at.
- Open [**Node frontmatter schema**](node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**Conflict files (conflicts/<run-id>-<n>.md)**](curation/map-conflict-files.md) — Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit.
### #skill
- Open [**curate (CLI command + /kk-curate skill)**](curation/map-curate-command.md) — Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent.
- Open [**/kk-bootstrap skill**](bootstrap/map-kk-bootstrap-skill.md) — Supervised, agent-driven first-pass bootstrap. Surveys docs, writes practice/map nodes directly under nodes/. Reviewer accepts via git commit.
### #state
- Open [**.state/state.json (lock + nudge state)**](state/map-state-file.md) — Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at.
- Open [**.state/bootstrap-state.json (per-doc hash cache)**](bootstrap/map-bootstrap-state-file.md) — Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored.
- Open [**Session log (_sessions/*.md)**](state/map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
### #supervision
- Open [**Bootstrap is supervised and judgmental, not exhaustive**](bootstrap/practice-bootstrap-is-supervised-and-judgmental.md) — /kk-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end.
