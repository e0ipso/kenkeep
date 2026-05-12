---
schema_version: 1
id: map-index-and-graph-files
title: "INDEX.md and GRAPH.md: deterministic outputs derived from nodes/"
kind: map
tags: [index, graph, deterministic, generated]
derived_from:
  - docs/how-it-works.md
  - docs/internals/architecture.md
  - docs/internals/schemas.md
relates_to: [map-nodes-directory, practice-determinism-contract]
depends_on: []
confidence: high
summary: "INDEX.md is the catalog of every valid node (title, path, tags) injected at session start. GRAPH.md is the full edge listing, read on demand. Both regenerated from nodes/ with no LLM."
---

# `INDEX.md` and `GRAPH.md`: deterministic outputs derived from `nodes/`

Two artifacts are regenerated deterministically (no LLM) from `nodes/`, and together they form three layers: INDEX is the catalog, node files are the detail, GRAPH is the traversal companion.

- **`INDEX.md`** is the catalog: every valid node appears, sorted by graph in-degree within each section (in-degree DESC, title ASC tiebreaker). Each bullet is title, path, and `#`-prefixed tags. A `## By topic` block lists every distinct tag (bucket size DESC, alpha tiebreaker) with the titles that carry it. The `kb-session-start.mjs` hook injects this into every new Claude Code session via the SessionStart `additionalContext` channel.
- **`GRAPH.md`** is the full edge listing (`derived_from`, `relates_to`, `depends_on`). It is **not** injected; the assistant reads it on demand when it needs the whole graph.

Frontmatter (validated by `IndexFrontmatterSchema` / `GraphFrontmatterSchema`) carries `schema_version`, `nodes_hash`, and `node_count`. `nodes_hash` is content-addressed and mtime-independent; consume compares it to the live tree and flags drift.

Regenerated automatically by `curate` at the end of every run, and again by the `lint-staged` pre-commit hook (`ai-knowledge-base index rebuild --stage`). Run `ai-knowledge-base index rebuild` manually after hand-edits or rebases.
