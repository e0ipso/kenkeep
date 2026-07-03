---
type: map
title: /kk-bootstrap skill
description: >-
  Supervised, agent-driven first-pass bootstrap: surveys docs and writes
  practice/map nodes under nodes/. Reviewer accepts via git commit.
tags:
  - skill
  - bootstrap
  - agent
kk_schema_version: 3
kk_id: map-kk-bootstrap-skill
kk_derived_from:
  - docs/installation.md
  - docs/daily-use.md
kk_relates_to:
  - map-bootstrap-incremental-command
  - practice-bootstrap-never-overwrites-existing-nodes
  - practice-bootstrap-is-supervised-and-judgmental
kk_depends_on: []
kk_confidence: high
---

# `/kk-bootstrap` skill

Supervised, agent-driven, one-pass bootstrap. The skill body lives at `src/templates-source/skills/kk-bootstrap/SKILL.md` (the bytes are identical across all five harnesses; the SKILL.md resolves the active harness at runtime via the `/tmp/kk-detect-harness.mjs` helper).

```
/kk-bootstrap                      # scans docs/ and root *.md
/kk-bootstrap docs/architecture    # scope to a path
```

The skill surveys markdown, splits content into `practice` and `map` nodes, and writes them directly under `.ai/kenkeep/nodes/`. It is **judgmental, not exhaustive** — samples, follows cross-references, stops to ask the user when scope is unclear. Existing nodes are never overwritten; collisions are skipped and reported.

Unlike `bootstrap-incremental`, the skill runs through the `Task` tool (a sub-agent), not a headless subprocess. Consequence: it honors `bootstrapModel.name` on a best-effort basis but ignores `bootstrapModel.effort` because the `Task` tool has no `effort` parameter.

Reviewer workflow: `git diff nodes/`, accept individual files with `git add nodes/<folder>/<file>.md && git commit`, reject the rest with `git restore nodes/<folder>/<file>.md`.

For re-runs after editing docs, use the headless `bootstrap-incremental` CLI instead (hash-aware, deterministic chunking).

<!-- kk:related:start -->
# Related

- Related: [map-bootstrap-incremental-command](/bootstrap/map-bootstrap-incremental-command.md)
- Related: [practice-bootstrap-never-overwrites-existing-nodes](/bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md)
- Related: [practice-bootstrap-is-supervised-and-judgmental](/bootstrap/practice-bootstrap-is-supervised-and-judgmental.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/daily-use.md](docs/daily-use.md)
<!-- kk:citations:end -->
