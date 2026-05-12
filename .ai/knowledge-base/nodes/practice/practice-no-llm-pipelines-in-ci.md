---
schema_version: 1
id: practice-no-llm-pipelines-in-ci
title: "Never run curate or bootstrap-incremental in CI"
kind: practice
tags: [ci, curate, bootstrap, policy]
derived_from:
  - docs/daily-use.md
relates_to: [map-ai-knowledge-base-cli]
depends_on: []
confidence: high
summary: "CI validates that what's committed is well-formed; it does not run LLM pipelines. curate and bootstrap-incremental write to nodes/ and need human review."
---

# Never run curate or bootstrap-incremental in CI

CI's job is to validate that what's committed is well-formed, not to run the LLM pipelines. A reasonable CI check is:

```sh
npx @e0ipso/ai-knowledge-base doctor --verbose
npx @e0ipso/ai-knowledge-base index rebuild
git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
```

The last step catches commits that bypassed the pre-commit hook.

Do **not** run `curate` or `bootstrap-incremental` in CI: they spawn `claude -p` and produce changes to `nodes/` that still need human review with `git diff`.
