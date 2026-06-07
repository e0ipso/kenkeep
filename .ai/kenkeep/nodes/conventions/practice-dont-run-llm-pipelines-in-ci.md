---
schema_version: 2
id: practice-dont-run-llm-pipelines-in-ci
title: Don't run curate or bootstrap-incremental in CI
kind: practice
tags:
  - ci
  - llm
  - workflow
derived_from:
  - docs/installation.md
  - docs/daily-use.md
relates_to:
  - map-curate-command
  - map-bootstrap-incremental-command
depends_on: []
confidence: high
summary: >-
  Both spawn the model and produce changes to nodes/ that still need human
  review. CI validates what's committed, not new LLM output.
---

# Don't run `curate` or `bootstrap-incremental` in CI

CI's job is to validate that what's committed is well-formed, not to run the LLM pipelines.

**Why:** `curate` and `bootstrap-incremental` both run an LLM pipeline that writes to `nodes/`. Running them in CI would produce node changes nobody reviewed, and the changes are non-deterministic. A reasonable CI check, by contrast, only validates that what's already committed is well-formed:

```sh
npx kenkeep doctor --verbose
npx kenkeep index rebuild
git diff --exit-code .ai/kenkeep/ENTRY.md .ai/kenkeep/GRAPH.md
```

The last step catches commits that bypassed the pre-commit hook.

**How to apply:**

- Never wire `curate` or `bootstrap-incremental` into a GitHub Action or other CI job.
- `doctor` and deterministic checks (`index rebuild` with `git diff --exit-code`) are fine.
- Run the LLM pipelines locally where the user can review their output before committing.
