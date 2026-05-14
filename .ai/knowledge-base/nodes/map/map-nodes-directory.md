---
schema_version: 1
id: map-nodes-directory
title: "nodes/ directory"
kind: map
tags: [layout, nodes, kb]
derived_from:
  - docs/how-it-works.md
  - docs/internals/schemas.md
relates_to: []
confidence: high
summary: "Canonical knowledge lives at nodes/{practice,map}/<id>.md; reviewed via git diff, accepted via git commit."
---

# `nodes/` directory

All canonical knowledge lives under `.ai/knowledge-base/nodes/`, split by kind:

- `nodes/practice/<id>.md` - see [[map-practice-node]].
- `nodes/map/<id>.md` - see [[map-map-node]].

Each file is a markdown document with YAML frontmatter validated by Zod (see [[map-node-frontmatter]]). Filenames must be `<id>.md` where `id == <kind>-<slug>`; mismatches are reported as lint errors.

The curator, the `node add` command, and the bootstrap pipelines all write here directly. There is no separate staging directory: the review surface is `git diff nodes/`, `git commit`, `git restore <path>`.
