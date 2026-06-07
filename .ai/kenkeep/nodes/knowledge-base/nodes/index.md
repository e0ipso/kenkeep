---
schema_version: 2
nodes_hash: 'sha256:3c880b1fd914a89255ac6364a6c2af871d602aff70dff00de714a68b90d9e5ef'
node_count: 5
---
# kenkeep Index: knowledge-base / nodes

_5 node(s) in this folder • ~2112 estimated tokens_

## Subfolders
_None._

## Conventions (how we build)
- **Node naming: id, filename, and kind must agree** [`knowledge-base/nodes/practice-lint-naming-rules.md`] Every node's id must equal <kind>-<slug>; the filename must be <id>.md under nodes/<kind>/. Lint reports mismatches as errors. #lint #naming #nodes
- **Review node changes via git** [`knowledge-base/nodes/practice-review-nodes-via-git.md`] All node changes are reviewed via git diff; accept with git commit, reject with git restore. Same workflow for curator output and bootstrap output. #review #git #workflow
- **Strict schema-version bump policy** [`knowledge-base/nodes/practice-strict-schema-version-bump-policy.md`] On-disk shapes carry schema_version. Breaking changes get a clean break: readers reject mismatches and direct users to re-init, with no compatibility shims or legacy read paths. A hidden, supervised `migrate` command is the one escape-hatch for crossing breaking layout bumps without re-init; it is deliberately unpublicized. #schema #versioning #breaking-change

## Components (what exists)
- **Node frontmatter schema** [`knowledge-base/nodes/map-node-frontmatter.md`] Required node fields: schema_version, id, title, kind, tags, derived_from, relates_to, depends_on, confidence, summary. #schema #frontmatter #nodes
- **nodes/ directory and the two kinds** [`knowledge-base/nodes/map-nodes-directory.md`] Knowledge nodes live as markdown under nodes/{practice,map}/<id>.md. Two kinds: practice (how we build) and map (what exists). #nodes #practice #map #frontmatter #schema

## By topic

- **#nodes (3):** Node frontmatter schema, nodes/ directory and the two kinds, Node naming: id, filename, and kind must agree
- **#schema (3):** Node frontmatter schema, nodes/ directory and the two kinds, Strict schema-version bump policy
- **#frontmatter (2):** Node frontmatter schema, nodes/ directory and the two kinds
- **#breaking-change (1):** Strict schema-version bump policy
- **#git (1):** Review node changes via git
- **#lint (1):** Node naming: id, filename, and kind must agree
- **#map (1):** nodes/ directory and the two kinds
- **#naming (1):** Node naming: id, filename, and kind must agree
- **#practice (1):** nodes/ directory and the two kinds
- **#review (1):** Review node changes via git
- **#versioning (1):** Strict schema-version bump policy
- **#workflow (1):** Review node changes via git
