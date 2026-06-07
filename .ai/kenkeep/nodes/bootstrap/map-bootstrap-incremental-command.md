---
schema_version: 2
id: map-bootstrap-incremental-command
title: bootstrap-incremental (CLI)
kind: map
tags:
  - cli
  - bootstrap
  - deterministic
derived_from:
  - docs/cli-reference.md
  - docs/installation.md
  - docs/daily-use.md
relates_to:
  - map-kk-bootstrap-skill
  - map-bootstrap-state-file
  - practice-bootstrap-never-overwrites-existing-nodes
  - practice-dont-run-llm-pipelines-in-ci
depends_on: []
confidence: high
summary: >-
  Headless, hash-aware bootstrap from existing markdown docs. Spawns the harness
  headless driver, batches docs in 20s, records SHA-256 in bootstrap-state.json.
---

# `bootstrap-incremental` (CLI)

```sh
npx kenkeep bootstrap-incremental --from <path> \
  [--include <glob>] [--exclude <glob>] \
  [--dry-run] [--timeout <ms>]
```

Deterministic, hash-aware bootstrap from existing markdown docs. Chunks candidate docs in batches of 20 and spawns the harness's headless driver to extract candidates. Records each doc's SHA-256 in `.ai/kenkeep/.state/bootstrap-state.json`, so re-runs only reprocess docs that changed.

- `--include <glob>` / `--exclude <glob>` — scope which markdown to consider.
- `--dry-run` — list what would be processed without calling the model.

Collision behavior matches the `/kk-bootstrap` skill: never overwrites an existing node. Collisions are skipped and reported.

Locking: takes the `bootstrap-incremental` lock in `state.json` (distinct from `curator`, so the two do not block each other).

Per-spawn model selection from `bootstrapModel: { name, effort }` in `config.yaml`.

Static file-discovery skips (applied by the CLI before any LLM call): `.gitignore`, the project's include/exclude rules, and a static skip list — `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `ENTRY.md`, `GRAPH.md`, `releases/**/*.md`.
