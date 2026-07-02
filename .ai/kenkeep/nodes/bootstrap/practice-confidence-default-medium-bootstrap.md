---
type: practice
title: 'Default bootstrap nodes to confidence: medium'
description: >-
  Bootstrap nodes default to confidence: medium; use high only when the source
  states the rule with rationale and looks actively maintained.
tags:
  - bootstrap
  - confidence
  - calibration
kk_schema_version: 3
kk_id: practice-confidence-default-medium-bootstrap
kk_derived_from:
  - src/templates-source/skills/kk-bootstrap/SKILL.md
  - docs/internals/schemas.md
kk_relates_to:
  - map-kk-bootstrap-skill
  - map-node-frontmatter
kk_depends_on: []
kk_confidence: high
---

# Default bootstrap nodes to `confidence: medium`

When `/kk-bootstrap` (or `bootstrap-incremental`) writes a candidate node, the default `confidence` is **medium**. Use `high` only when the source doc explicitly states the rule **with rationale** AND the doc looks actively maintained.

**Why:** existing docs may be stale or aspirational. Pinning a fresh extraction at `high` shifts the burden of skepticism onto the reviewer at exactly the moment they're being asked to scan a wall of new files. A `medium` default keeps reviewers' guard up for the cases where it matters; the field can be promoted later if the rule keeps holding.

**How to apply:**

- New bootstrap candidate, ambiguous phrasing in source doc → `medium`.
- New bootstrap candidate, source doc says "always do X because Y" and the doc was recently touched → `high`.
- Speculative or aspirational source content ("we should eventually…") → don't extract at all (it should be filtered, not downgraded to `low`).
- The curator follows the same calibration when emitting `add` actions from session captures: `medium` for implicit sources, `high` when stated explicitly with rationale.

<!-- kk:related:start -->
# Related

- Related: [map-kk-bootstrap-skill](/bootstrap/map-kk-bootstrap-skill.md)
- Related: [map-node-frontmatter](/node-schema/map-node-frontmatter.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [src/templates-source/skills/kk-bootstrap/SKILL.md](src/templates-source/skills/kk-bootstrap/SKILL.md)
[2] [docs/internals/schemas.md](docs/internals/schemas.md)
<!-- kk:citations:end -->
