---
schema_version: 1
id: map-index-and-graph-files
title: "INDEX.md and GRAPH.md: deterministic outputs derived from nodes/"
kind: map
tags: [index, graph, deterministic, generated]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/how-it-works.md
  - docs/internals/architecture.md
  - docs/internals/schemas.md
relates_to: [map-nodes-directory, practice-determinism-contract]
depends_on: []
confidence: high
summary: "INDEX.md is the token-budgeted view injected into every new session. GRAPH.md is the full edge listing, read on demand. Both regenerated from nodes/ with no LLM."
---

# `INDEX.md` and `GRAPH.md`: deterministic outputs derived from `nodes/`

Two artifacts are regenerated deterministically (no LLM) from `nodes/`:

- **`INDEX.md`** is a slim, token-budgeted view (default `indexBudgetTokens: 2000`). The `kb-session-start.mjs` hook injects this into every new Claude Code session via the SessionStart `additionalContext` channel.
- **`GRAPH.md`** is the full edge listing (`supersedes` / `superseded_by`, `derived_from`, `relates_to`, `depends_on`). It is **not** injected; the assistant reads it on demand when it needs the whole graph.

Frontmatter (validated by `IndexFrontmatterSchema` / `GraphFrontmatterSchema`) carries `generated_at`, `nodes_hash`, `node_count`, and (INDEX only) `budget_tokens`. `nodes_hash` is content-addressed and mtime-independent; consume compares it to the live tree and flags drift.

Regenerated automatically by `curate` at the end of every run, and again by the `lint-staged` pre-commit hook (`ai-knowledge-base index rebuild --stage`). Run `ai-knowledge-base index rebuild` manually after hand-edits or rebases.
