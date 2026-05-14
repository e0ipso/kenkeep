---
schema_version: 1
id: practice-no-llm-pipelines-in-ci
title: "Don't run curate or bootstrap-incremental in CI"
kind: practice
tags: [ci, llm, prohibition]
derived_from:
  - docs/daily-use.md
  - docs/installation.md
relates_to: []
confidence: high
summary: "CI validates committed shape; curate and bootstrap-incremental spawn the model and produce changes that still need human review."
---

# Don't run `curate` or `bootstrap-incremental` in CI

CI's job is to validate that what's committed is well-formed, not to run the LLM pipelines. A reasonable CI block is:

```sh
npx @e0ipso/ai-knowledge-base doctor --verbose
npx @e0ipso/ai-knowledge-base index rebuild
git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
```

The `git diff --exit-code` catches commits that bypassed the pre-commit hook.

**Why:** `curate` and `bootstrap-incremental` spawn `claude -p` and write directly to `nodes/`. The output still needs human review via `git diff`. Running them in CI would either commit unreviewed changes or burn LLM time on a workflow that produces an unreviewable diff against `main`.

**How to apply:** CI scripts use `doctor`, `index rebuild`, and `git diff --exit-code` only. Never wire `curate` or `bootstrap-incremental` into CI, even as a "drift check".
