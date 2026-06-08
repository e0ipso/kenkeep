---
schema_version: 2
nodes_hash: 'sha256:212039fda9ba9e61f241b4c234f5bc7c0eb1104387c5f58a3db1557f1b748727'
node_count: 4
summary: >-
  the node frontmatter schema, the nodes/ directory model, and the naming and
  schema-version rules
---
# kenkeep Index: node-schema

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Node naming: id, filename, and kind must agree**](node-schema/practice-lint-naming-rules.md) to learn about: Every node's id must equal <kind>-<slug>; the filename must be <id>.md in its topical folder under nodes/. Lint reports mismatches as errors. #lint #naming #nodes
- Open [**Strict schema-version bump policy**](node-schema/practice-strict-schema-version-bump-policy.md) to learn about: On-disk shapes carry schema_version. Breaking changes get a clean break: readers reject mismatches and direct users to re-init, with no compatibility shims or legacy read paths. A hidden, supervised `migrate` command is the one escape-hatch for crossing breaking layout bumps without re-init; it is deliberately unpublicized. #schema #versioning #breaking-change

## Components (what exists)
- Open [**Node frontmatter schema**](node-schema/map-node-frontmatter.md) to learn about: Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary. #schema #frontmatter #nodes
- Open [**nodes/ directory and the two kinds**](node-schema/map-nodes-directory.md) to learn about: Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory. #nodes #practice #map #frontmatter #schema

## By topic

### #nodes
- Open [**Node frontmatter schema**](node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**nodes/ directory and the two kinds**](node-schema/map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
- Open [**Bootstrap never overwrites existing nodes**](bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #schema
- Open [**.state/state.json (lock + nudge state)**](state/map-state-file.md) — Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks reclaimed) and last_nudged_at.
- Open [**Node frontmatter schema**](node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**Conflict files (conflicts/<run-id>-<n>.md)**](curation/map-conflict-files.md) — Curator-detected contradictions: one markdown file per conflict under conflicts/; resolved by /kk-curate skill via git restore/commit.
### #frontmatter
- Open [**Node frontmatter schema**](node-schema/map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**nodes/ directory and the two kinds**](node-schema/map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
### #breaking-change
- Open [**Strict schema-version bump policy**](node-schema/practice-strict-schema-version-bump-policy.md) — On-disk shapes carry schema_version. Breaking changes get a clean break: readers reject mismatches and direct users to re-init, with no compatibility shims or legacy read paths. A hidden, supervised `migrate` command is the one escape-hatch for crossing breaking layout bumps without re-init; it is deliberately unpublicized.
### #lint
- Open [**Node naming: id, filename, and kind must agree**](node-schema/practice-lint-naming-rules.md) — Every node's id must equal <kind>-<slug>; the filename must be <id>.md in its topical folder under nodes/. Lint reports mismatches as errors.
### #map
- Open [**nodes/ directory and the two kinds**](node-schema/map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
### #naming
- Open [**Node naming: id, filename, and kind must agree**](node-schema/practice-lint-naming-rules.md) — Every node's id must equal <kind>-<slug>; the filename must be <id>.md in its topical folder under nodes/. Lint reports mismatches as errors.
### #practice
- Open [**nodes/ directory and the two kinds**](node-schema/map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
### #versioning
- Open [**Bump the prompt's Version comment on every behavior change**](config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent.
- Open [**Strict schema-version bump policy**](node-schema/practice-strict-schema-version-bump-policy.md) — On-disk shapes carry schema_version. Breaking changes get a clean break: readers reject mismatches and direct users to re-init, with no compatibility shims or legacy read paths. A hidden, supervised `migrate` command is the one escape-hatch for crossing breaking layout bumps without re-init; it is deliberately unpublicized.
