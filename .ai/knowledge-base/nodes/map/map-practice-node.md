---
schema_version: 1
id: map-practice-node
title: "Practice node"
kind: map
tags: [node, kind, vocabulary]
derived_from:
  - PRD.md
  - docs/internals/schemas.md
  - docs/how-it-works.md
relates_to: []
confidence: high
summary: "Practice nodes capture imperative project guidance: conventions, prohibitions, gotchas, rationale, tooling."
---

# Practice node

A **practice** node records *how we build*: imperative project guidance that the AI should follow or honor.

Concretely, a practice node covers:

- **Conventions** ("when adding schema.org metadata, use the custom event setup in `modules/custom/<name>`")
- **Prohibitions** ("don't use the default cache tags for entity X")
- **Gotchas** (finicky third-party integration details, brittle config)
- **Decision rationale** (why the current approach exists, especially when non-obvious)
- **Tooling and workflow** ("tests run with `vendor/bin/phpunit ...`")

Practice nodes live under `nodes/practice/<id>.md` with `kind: practice` in frontmatter. They are paired with their counterpart [[map-map-node]] when a captured statement mixes "do this" with "this thing exists".
