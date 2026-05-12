---
schema_version: 1
id: map-map-node
title: "Map node: what-exists, named entities and vocabulary"
kind: map
tags: [vocabulary, node-kind, map]
derived_from:
  - docs/how-it-works.md
  - docs/internals/schemas.md
  - PRD.md
relates_to: [map-practice-node, map-nodes-directory]
depends_on: []
confidence: high
summary: "A map node captures named things that exist in the project: modules, services, vocabulary, file-tree locations. Stored under nodes/map/."
---

# Map node: what-exists, named entities and vocabulary

A **map** node captures "what exists in the project": named features/modules/services and what they do, project-specific vocabulary ("Bravo Insider = personalized section on the platform"), and locations of major systems in the file tree.

Stored at `.ai/knowledge-base/nodes/map/<id>.md`. The id slug is `map-<slug>`. Frontmatter shape is defined by `NodeFrontmatterSchema` in `src/lib/schemas.ts`.

Map content is nominative (what something is, where it lives). Imperative content (do/don't/why) belongs to practice. Stage-2 enforces this boundary; curator and bootstrap should respect it too.
