---
type: practice
title: Don't run curate or bootstrap-incremental in CI
description: >-
  Both spawn the model and produce changes to nodes/ that still need human
  review. CI validates what's committed, not new LLM output.
tags:
  - ci
  - llm
  - workflow
kk_schema_version: 3
kk_id: practice-dont-run-llm-pipelines-in-ci
kk_derived_from:
  - docs/installation.md
  - docs/daily-use.md
kk_relates_to:
  - map-curate-command
  - map-bootstrap-incremental-command
kk_depends_on: []
kk_confidence: high
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

<!-- kk:related:start -->
# Related

- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-bootstrap-incremental-command](/bootstrap/map-bootstrap-incremental-command.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/daily-use.md](docs/daily-use.md)
<!-- kk:citations:end -->
