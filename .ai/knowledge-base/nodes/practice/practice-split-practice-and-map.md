---
schema_version: 1
id: practice-split-practice-and-map
title: "Split combined statements into separate practice and map nodes"
kind: practice
tags: [extraction, prompts, modeling]
derived_from:
  - PRD.md
  - docs/internals/schemas.md
  - docs/internals/prompts.md
relates_to: []
confidence: high
summary: "When a captured statement mixes 'how to do X' with 'X exists', emit one practice node and one map node, not a hybrid."
---

# Split combined statements into separate practice and map nodes

When a captured statement mixes "how to do X" with "X exists", emit one practice node and one map node. Example: "use `bravo_analytics.dispatcher`, our event-tracking service" becomes:

- A [[map-practice-node]] for the imperative: *use the dispatcher to track events*.
- A [[map-map-node]] for the entity: *`bravo_analytics.dispatcher` is the project's event-tracking service, located at \<path\>*.

**Why:** the two kinds have different lifetimes and different review value. The practice node is what the agent should *do*; the map node is what the agent should *know about*. Hybrid nodes muddy the boundary and make later modifications (rename the dispatcher, change the guidance) harder. The proposal extractor and curator prompts both enforce this split; crossing the practice/map boundary is listed as a curator anti-pattern.

**How to apply:**

- When writing `kb-add`, bootstrap candidates, or curator output: never write a node whose body is "X is a service - and you should use it for Y". Split it.
- Link the two with `relates_to` so the graph carries the association.
