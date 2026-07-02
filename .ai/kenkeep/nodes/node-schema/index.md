# kenkeep Index: node-schema

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Strict schema-version bump policy**](practice-strict-schema-version-bump-policy.md) to learn about: schema_version bumps are a clean break: readers reject mismatches, no shims; a hidden supervised migrate command is the escape hatch. #schema #versioning #breaking-change
- Open [**Node naming: id, filename, and kind must agree**](practice-lint-naming-rules.md) to learn about: Every node's id must equal <kind>-<slug> and its filename <id>.md in its topical folder under nodes/; lint reports mismatches as errors. #lint #naming #nodes

## Components (what exists)
- Open [**Node frontmatter schema**](map-node-frontmatter.md) to learn about: Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary. #schema #frontmatter #nodes
- Open [**nodes/ directory and the two kinds**](map-nodes-directory.md) to learn about: Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory. #nodes #practice #map #frontmatter #schema

## By topic

### #nodes
- Open [**Node frontmatter schema**](map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**nodes/ directory and the two kinds**](map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
- Open [**Bootstrap never overwrites existing nodes**](../bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md) — Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged.
### #schema
- Open [**Knowledge pack format contract**](../pack/map-knowledge-pack-format.md) — A pack root has kenkeep-pack.yaml, README.md, knowledge/; PackManifestSchema validates the manifest; knowledge/ is a nodes/-shaped tree.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**.state/state.json (lock + nudge state)**](../state/map-state-file.md) — Gitignored runtime state with only last_nudged_at; the proposal-drain lock is a sidecar lockfile dir (60s stale), not a JSON field.
### #frontmatter
- Open [**Node frontmatter schema**](map-node-frontmatter.md) — Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary.
- Open [**nodes/ directory and the two kinds**](map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
### #breaking-change
- Open [**Strict schema-version bump policy**](practice-strict-schema-version-bump-policy.md) — schema_version bumps are a clean break: readers reject mismatches, no shims; a hidden supervised migrate command is the escape hatch.
### #lint
- Open [**Node naming: id, filename, and kind must agree**](practice-lint-naming-rules.md) — Every node's id must equal <kind>-<slug> and its filename <id>.md in its topical folder under nodes/; lint reports mismatches as errors.
### #map
- Open [**nodes/ directory and the two kinds**](map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
### #naming
- Open [**Node naming: id, filename, and kind must agree**](practice-lint-naming-rules.md) — Every node's id must equal <kind>-<slug> and its filename <id>.md in its topical folder under nodes/; lint reports mismatches as errors.
### #practice
- Open [**nodes/ directory and the two kinds**](map-nodes-directory.md) — Knowledge nodes are markdown files in nested topical folders under nodes/; kind (practice/map) is a frontmatter facet, not a directory.
### #versioning
- Open [**Strict schema-version bump policy**](practice-strict-schema-version-bump-policy.md) — schema_version bumps are a clean break: readers reject mismatches, no shims; a hidden supervised migrate command is the escape hatch.
- Open [**Bump the prompt's Version comment on every behavior change**](../config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record it so audits stay coherent.