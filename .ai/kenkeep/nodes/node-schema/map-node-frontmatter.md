---
type: map
title: Node frontmatter schema
description: >-
  Required node fields: schema_version, id, title, kind, tags, derived_from,
  relates_to, depends_on, confidence, summary.
tags:
  - schema
  - frontmatter
  - nodes
kk_schema_version: 3
kk_id: map-node-frontmatter
kk_derived_from:
  - docs/internals/schemas.md
kk_relates_to:
  - map-nodes-directory
  - map-entry-md
  - map-graph-md
kk_depends_on: []
kk_confidence: high
---

# Node frontmatter schema

Every leaf file under `nodes/` (in its topical folder) carries this YAML frontmatter (validated by `NodeFrontmatterSchema` in `src/lib/schemas.ts`):

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
- `kind` — `practice` or `map`. A facet, not a directory: it does not drive placement (folders are topical); it selects the folder index node section the node renders in (Conventions vs Components) and is the prefix of the `id`.
- `tags` — free-form labels for the `## By topic` section of the folder index nodes.
- `derived_from` — list of sources. Dangling refs are reported by `doctor --verbose` but silently ignored by the consume path.
- `relates_to` — loose cross-references, rendered in `GRAPH.md`. Not enforced.
- `depends_on` — strict cross-references, rendered in `GRAPH.md`. Not enforced.
- `confidence` — `low`, `medium`, `high`. Curator default: `medium` for implicit sources, `high` when stated explicitly with rationale.
- `summary` — ≤140-character one-liner shown in the folder index nodes.

Git history is the timeline of record; the frontmatter carries no separate timestamps.

<!-- kk:related:start -->
# Related

- Related: [map-nodes-directory](/node-schema/map-nodes-directory.md)
- Related: [map-entry-md](/index/map-entry-md.md)
- Related: [map-graph-md](/index/map-graph-md.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/schemas.md](docs/internals/schemas.md)
<!-- kk:citations:end -->
