---
type: map
title: bootstrap-incremental (CLI)
description: >-
  Headless, hash-aware bootstrap from markdown docs: spawns the harness driver,
  batches docs in 20s, records SHA-256 in bootstrap-state.json.
tags:
  - cli
  - bootstrap
  - deterministic
kk_schema_version: 3
kk_id: map-bootstrap-incremental-command
kk_derived_from:
  - docs/installation.md
  - docs/daily-use.md
kk_relates_to:
  - map-kk-bootstrap-skill
  - map-bootstrap-state-file
  - practice-bootstrap-never-overwrites-existing-nodes
  - practice-dont-run-llm-pipelines-in-ci
kk_depends_on: []
kk_confidence: high
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

Locking: the command itself takes no `state.json` lock (single-author). The `node write` primitive it drives does take a `proper-lockfile` lock, but on the separate `bootstrap-state.json` (with retries, to serialise concurrent `--source-doc` hash-map writers) — not on `state.json`.

Per-spawn model selection from `bootstrapModel: { name, effort }` in `config.yaml`.

Static file-discovery skips (applied by the CLI before any LLM call): `.gitignore`, the project's include/exclude rules, and a static skip list — `LICENSE`, `CHANGELOG`, `CODE_OF_CONDUCT`, `CONTRIBUTORS`, `ENTRY.md`, `GRAPH.md`, `releases/**/*.md`.

<!-- kk:related:start -->
# Related

- Related: [map-kk-bootstrap-skill](/bootstrap/map-kk-bootstrap-skill.md)
- Related: [map-bootstrap-state-file](/bootstrap/map-bootstrap-state-file.md)
- Related: [practice-bootstrap-never-overwrites-existing-nodes](/bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md)
- Related: [practice-dont-run-llm-pipelines-in-ci](/conventions/practice-dont-run-llm-pipelines-in-ci.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/daily-use.md](docs/daily-use.md)
<!-- kk:citations:end -->
