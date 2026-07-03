---
type: map
title: Node frontmatter schema
description: OKF-native type/title/description/tags plus kk_-prefixed id, edges, provenance, confidence, and schema version.
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

Every leaf file under `nodes/` (in its topical folder) is an OKF v0.1 concept document with this YAML frontmatter (validated by `NodeFrontmatterSchema` in `src/lib/schemas.ts`):

```yaml
---
type: practice | map                    # OKF native
title: "..."                            # OKF native
description: "one-line summary, shown in the folder index nodes"  # OKF native
tags: [string, ...]                     # OKF native
kk_schema_version: 3
kk_id: <type>-<slug>
kk_derived_from:
  - <session-log-filename | doc-path | absolute-path>
kk_relates_to: [<kk_id>, ...]
kk_depends_on: [<kk_id>, ...]
kk_confidence: low | medium | high
---
```

The unprefixed keys are OKF's native vocabulary; the `kk_`-prefixed keys are kenkeep extensions (OKF permits producer extension keys). Field meanings:

- `type` — `practice` or `map`. A facet, not a directory: it does not drive placement (folders are topical); it selects the folder index node section the node renders in (Conventions vs Components) and is the prefix of the `kk_id`.
- `title` — human label rendered in the folder index nodes and `GRAPH.md`.
- `description` — one-liner shown in the folder index nodes (OKF's `description`, formerly `summary`).
- `tags` — free-form labels for the `## By topic` section of the folder index nodes.
- `kk_id` — `<type>-<slug>`. Used by `kk_relates_to`, `kk_depends_on`, `kk_derived_from`, and curator `target_node_id`. Stable across rebalance moves, where OKF's own path-based identity is not.
- `kk_derived_from` — list of sources, rendered into the `# Citations` body section. Dangling refs are reported by `doctor --verbose` but silently ignored by the consume path.
- `kk_relates_to` — loose cross-references, rendered in `GRAPH.md` and the `Related` body section. Dangling-checked by lint.
- `kk_depends_on` — strict cross-references, rendered in `GRAPH.md` and the `Related` body section. Defaults to `[]`.
- `kk_confidence` — `low`, `medium`, `high`. Curator default: `medium` for implicit sources, `high` when stated explicitly with rationale.

Two body sections are regenerated deterministically from the frontmatter on every write — a labeled `Related` links section and a numbered `# Citations` section — so plain OKF consumers can traverse edges and see provenance. Git history is the timeline of record; the frontmatter carries no separate timestamps.

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
