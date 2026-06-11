---
schema_version: 2
id: map-kk-bootstrap-skill
title: /kk-bootstrap skill
kind: map
tags:
  - skill
  - bootstrap
  - agent
derived_from:
  - docs/installation.md
  - docs/daily-use.md
relates_to:
  - map-bootstrap-incremental-command
  - practice-bootstrap-never-overwrites-existing-nodes
  - practice-bootstrap-is-supervised-and-judgmental
depends_on: []
confidence: high
summary: >-
  Supervised, agent-driven first-pass bootstrap. Surveys docs, writes
  practice/map nodes directly under nodes/. Reviewer accepts via git commit.
---

# `/kk-bootstrap` skill

Supervised, agent-driven, one-pass bootstrap. The skill body lives at `src/templates-source/skills/kk-bootstrap/SKILL.md` (the bytes are identical across all three harnesses; the SKILL.md resolves the active harness at runtime via the `/tmp/kk-detect-harness.mjs` helper).

```
/kk-bootstrap                      # scans docs/ and root *.md
/kk-bootstrap docs/architecture    # scope to a path
```

The skill surveys markdown, splits content into `practice` and `map` nodes, and writes them directly under `.ai/kenkeep/nodes/`. It is **judgmental, not exhaustive** — samples, follows cross-references, stops to ask the user when scope is unclear. Existing nodes are never overwritten; collisions are skipped and reported.

Unlike `bootstrap-incremental`, the skill runs through the `Task` tool (a sub-agent), not a headless subprocess. Consequence: it honors `bootstrapModel.name` on a best-effort basis but ignores `bootstrapModel.effort` because the `Task` tool has no `effort` parameter.

Reviewer workflow: `git diff nodes/`, accept individual files with `git add nodes/<folder>/<file>.md && git commit`, reject the rest with `git restore nodes/<folder>/<file>.md`.

For re-runs after editing docs, use the headless `bootstrap-incremental` CLI instead (hash-aware, deterministic chunking).
