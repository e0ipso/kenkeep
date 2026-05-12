---
schema_version: 1
id: map-nodes-directory
title: "nodes/: the canonical knowledge tree"
kind: map
tags: [storage, nodes, canonical, git]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/how-it-works.md
  - docs/internals/architecture.md
relates_to: [map-practice-node, map-map-node, map-index-and-graph-files]
depends_on: []
confidence: high
summary: "The committed knowledge tree at .ai/knowledge-base/nodes/{practice,map}/. Curator, node add, bootstrap, and humans all write here; review is git diff; acceptance is git commit."
---

# `nodes/`: the canonical knowledge tree

The committed knowledge tree lives at `.ai/knowledge-base/nodes/{practice,map}/<id>.md`. This is the canonical state of the KB; everything else (sessions, logs, state files, index) is supporting infrastructure.

All four producers write here directly:

- The **curator** (`curate` CLI / `/kb-curate` skill) writes `add` actions to new files and overwrites `modify` targets.
- The **manual-add** path (`node add` CLI / `/kb-add` skill) writes new files interactively.
- **Bootstrap** (`/kb-bootstrap` skill, `bootstrap-incremental` CLI) writes new files from existing docs. Existing nodes are never overwritten; collisions are skipped and reported.
- **Humans** edit directly when needed (rebases, in-session conflict resolution, hand corrections).

Review is `git diff nodes/`; acceptance is `git commit`; rejection is `git restore <path>`. The lint-staged pre-commit hook regenerates `INDEX.md` / `GRAPH.md` and stages them into the same commit, so the injected index can never drift from the committed nodes.
