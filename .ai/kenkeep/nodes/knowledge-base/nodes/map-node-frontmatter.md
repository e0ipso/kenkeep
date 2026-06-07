---
schema_version: 2
id: map-node-frontmatter
title: Node frontmatter schema
kind: map
tags:
  - schema
  - frontmatter
  - nodes
derived_from:
  - docs/internals/schemas.md
relates_to:
  - map-nodes-directory
  - map-entry-md
  - map-graph-md
depends_on: []
confidence: high
summary: >-
  Required node fields: schema_version, id, title, kind, tags, derived_from,
  relates_to, depends_on, confidence, summary.
---

# Node frontmatter schema

Every file under `nodes/<kind>/` carries this YAML frontmatter (validated by `NodeFrontmatterSchema` in `src/lib/schemas.ts`):

```yaml
---
schema_version: 2
id: <kind>-<slug>
title: "..."
kind: practice | map
tags: [string, ...]
derived_from:
  - <session-log-filename | doc-path | absolute-path>
relates_to: [<node-id>, ...]
depends_on: [<node-id>, ...]
confidence: low | medium | high
summary: "≤140 char summary, shown in the folder index nodes"
---
```

Field meanings:

- `id` — `<kind>-<slug>`. Used by `relates_to`, `depends_on`, `derived_from`, and curator `target_node_id`. Stable.
- `title` — human label rendered in the folder index nodes and `GRAPH.md`.
- `kind` — `practice` or `map`. Drives directory placement under `nodes/<kind>/` and the folder index node section the node lands in (Conventions vs Components).
- `tags` — free-form labels for the `## By topic` section of the folder index nodes.
- `derived_from` — list of sources. Dangling refs are reported by `doctor --verbose` but silently ignored by the consume path.
- `relates_to` — loose cross-references, rendered in `GRAPH.md`. Not enforced.
- `depends_on` — strict cross-references, rendered in `GRAPH.md`. Not enforced.
- `confidence` — `low`, `medium`, `high`. Curator default: `medium` for implicit sources, `high` when stated explicitly with rationale.
- `summary` — ≤140-character one-liner shown in the folder index nodes.

Git history is the timeline of record; the frontmatter carries no separate timestamps.
