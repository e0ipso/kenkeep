---
schema_version: 1
id: practice-deterministic-index-graph-regeneration
title: "INDEX.md and GRAPH.md are deterministic outputs of nodes/"
kind: practice
tags: [index, graph, determinism, hooks]
derived_from:
  - docs/internals/architecture.md
  - docs/internals/schemas.md
  - docs/cli-reference.md
relates_to: []
confidence: high
summary: "INDEX/GRAPH regenerate deterministically from nodes/; the lint-staged pre-commit hook stages them into every nodes/ commit."
---

# `INDEX.md` and `GRAPH.md` are deterministic outputs of `nodes/`

`INDEX.md` and `GRAPH.md` are *pure functions* of the `nodes/` tree (plus an injected `now`). No LLM, no randomness beyond `crypto.randomUUID()` scoped to run-id minting.

Three regeneration sites:

1. End of every `curate` run.
2. `ai-knowledge-base index rebuild [--stage]`.
3. The `lint-staged` pre-commit hook (configured by `init` in `.lintstagedrc.cjs`) runs `index rebuild --stage` whenever a file under `nodes/` is staged. `--stage` runs `git add` on the regenerated `INDEX.md`/`GRAPH.md` so they land in the same commit. It skips the regen and stages nothing when the recorded `nodes_hash` already matches the live tree.

The hash is content-addressed and mtime-independent (`computeNodesHash` in `src/lib/nodes.ts`): for each `.md` under `nodes/`, hash contents, build `<relative-path>\t<sha256-hex>` lines, sort lexicographically, join with `\n`, then `nodes_hash = sha256(joined)`.

**Why:** the injected `INDEX.md` is the AI's view of the KB. Drift between it and committed nodes would mislead every future session.

**How to apply:**

- Never edit `INDEX.md` / `GRAPH.md` by hand. If `doctor` reports staleness, run `index rebuild`.
- New tests for index/graph generation use golden-file comparisons (see `tests/lib/index-gen.test.ts`); the determinism contract is load-bearing.
- New randomness or time-dependence in generation code must be injected (like `now`), not pulled from `Date.now()` directly.
