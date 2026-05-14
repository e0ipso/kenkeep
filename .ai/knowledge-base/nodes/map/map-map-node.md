---
schema_version: 1
id: map-map-node
title: "Map node"
kind: map
tags: [node, kind, vocabulary]
derived_from:
  - PRD.md
  - docs/internals/schemas.md
relates_to: []
confidence: high
summary: "Map nodes capture what exists in the project: named features, modules, vocabulary, and locations."
---

# Map node

A **map** node records *what exists* in the project. It names things and points the agent to them.

Covers:

- **Features and architecture** - systems being built, what they do, where their seams are.
- **Vocabulary** - project-specific terms ("Bravo Insider = personalized section on the platform"), internal module names, custom entity names.
- **Locations** - where major systems live in the file tree.

Map nodes live under `nodes/map/<id>.md` with `kind: map`. The proposal extractor and curator are explicitly instructed to split combined statements: "use `bravo_analytics.dispatcher`, our event-tracking service" becomes one [[map-practice-node]] (use the dispatcher) and one map node (what the dispatcher is).
