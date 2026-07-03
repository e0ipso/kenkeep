---
type: practice
title: Keep ENTRY.md lean and bounded — no topic map
description: >-
  The top-level entry catalog (ENTRY.md) stays intentionally lean and bounded,
  containing no global topic map.
tags:
  - kenkeep
  - entry
  - index
  - design
kk_schema_version: 3
kk_id: practice-keep-entry-md-lean-and-bounded-no-topic-map
kk_derived_from: []
kk_relates_to:
  - map-entry-md
kk_depends_on: []
kk_confidence: high
---
The top-level entry catalog (`.ai/kenkeep/ENTRY.md`) is purpose-built as a concise, bounded whole-tree launchpad. It does not include a global topic-map section, which would grow with tag cardinality and inject excessive tokens into every session. Instead, it lists only the top-level branch structure with compact node counts. This keeps the entry point token-efficient while maintaining recall effectiveness. The frontmatter preserves the global `nodes_hash` for staleness detection. A legacy `INDEX.md` is removed on rebuild and read with fallback for un-rebuilt repos.

<!-- kk:related:start -->
# Related

- Related: [map-entry-md](/index/map-entry-md.md)
<!-- kk:related:end -->
