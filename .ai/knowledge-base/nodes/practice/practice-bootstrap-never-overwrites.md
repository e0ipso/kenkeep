---
schema_version: 1
id: practice-bootstrap-never-overwrites
title: "Bootstrap never overwrites an existing node"
kind: practice
tags: [bootstrap, prohibition, conservative]
derived_from:
  - PRD.md
  - docs/installation.md
  - docs/daily-use.md
relates_to: []
confidence: high
summary: "Both /kb-bootstrap and bootstrap-incremental skip collisions and report them; they never modify existing nodes."
---

# Bootstrap never overwrites an existing node

Both bootstrap paths are conservative:

- The `/kb-bootstrap` skill (agent-driven, supervised) skips any candidate whose target filename already exists under `nodes/` and surfaces it in the final report.
- `npx @e0ipso/ai-knowledge-base bootstrap-incremental --from <path>` does the same: collisions are dropped and counted in the run summary.

**Why:** bootstrap is a judgmental seed from existing docs. It does not have the curator's modify/contradict logic and would risk clobbering hand-curated content. The PRD makes this explicit: "Bootstrap is conservative: it never overwrites an existing node - collisions are skipped and reported." Incremental bootstrap intentionally does *not* try to detect overlap with existing nodes via modify/contradict; v1 produces additions only and relies on the reviewer to catch duplicates.

**How to apply:**

- New bootstrap candidates land as `add` only.
- If a candidate slug collides, refine the title or skip; do not rename or modify the existing node from within bootstrap.
- The reviewer is the merge mechanism: read `git diff nodes/`, decide whether to merge content manually.
