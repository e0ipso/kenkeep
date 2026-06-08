---
schema_version: 2
id: practice-lint-naming-rules
title: 'Node naming: id, filename, and kind must agree'
kind: practice
tags:
  - lint
  - naming
  - nodes
derived_from:
  - README.md
  - docs/internals/schemas.md
relates_to:
  - map-nodes-directory
  - map-node-frontmatter
depends_on: []
confidence: high
summary: >-
  Every node's id must equal <kind>-<slug>; the filename must be <id>.md in its
  topical folder under nodes/. Lint reports mismatches as errors.
---

# Node naming: id, filename, and kind must agree

The `lint` command (`npx kenkeep lint`) runs four no-LLM checks. The hard rules:

- **Slug / id naming** — every node's frontmatter `id` must equal `<kind>-<slug>`. The filename must be `<id>.md` (in its topical folder under `nodes/`). Mismatches are errors (exit code 1).
- **Dangling structured edges** — any `relates_to` or `depends_on` reference that does not resolve to a node id is reported as an error.

The other two lint checks produce findings (not errors):

- **Tag near-duplicates** — tags that normalize to the same form (case-folded, separator-stripped, single trailing-`s` stripped) are clustered and reported when two or more variants exist.
- **Orphans** — nodes that neither reference nor are referenced by another node.

**Why:** the id is the join key the curator (`target_node_id`), bootstrap (`derived_from`), and graph generator all use. A divergent id/filename/kind produces silently-broken edges and a `GRAPH.md` that lies. Lint as an error gate makes the contract enforceable in CI.

**How to apply:**

- When writing nodes by hand, pick the slug carefully on the first commit; renaming a node means rewriting every inbound `relates_to`/`depends_on`.
- Lint also runs automatically every `lintEveryNSessions` sessions (default 50) via a SessionEnd async hook; the summary surfaces at the next SessionStart as a single nudge line. Running the CLI clears it.
- `doctor` checks install health; `lint` checks content health. Different jobs — both green is the bar.
