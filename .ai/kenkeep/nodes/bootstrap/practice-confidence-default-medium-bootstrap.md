---
schema_version: 2
id: practice-confidence-default-medium-bootstrap
title: 'Default bootstrap nodes to confidence: medium'
kind: practice
tags:
  - bootstrap
  - confidence
  - calibration
derived_from:
  - src/templates-source/skills/kk-bootstrap/SKILL.md
  - docs/internals/schemas.md
relates_to:
  - map-kk-bootstrap-skill
  - map-node-frontmatter
depends_on: []
confidence: high
summary: >-
  Bootstrap nodes default to confidence: medium; use high only when the source
  doc states the rule with rationale and looks actively maintained.
---

# Default bootstrap nodes to `confidence: medium`

When `/kk-bootstrap` (or `bootstrap-incremental`) writes a candidate node, the default `confidence` is **medium**. Use `high` only when the source doc explicitly states the rule **with rationale** AND the doc looks actively maintained.

**Why:** existing docs may be stale or aspirational. Pinning a fresh extraction at `high` shifts the burden of skepticism onto the reviewer at exactly the moment they're being asked to scan a wall of new files. A `medium` default keeps reviewers' guard up for the cases where it matters; the field can be promoted later if the rule keeps holding.

**How to apply:**

- New bootstrap candidate, ambiguous phrasing in source doc → `medium`.
- New bootstrap candidate, source doc says "always do X because Y" and the doc was recently touched → `high`.
- Speculative or aspirational source content ("we should eventually…") → don't extract at all (it should be filtered, not downgraded to `low`).
- The curator follows the same calibration when emitting `add` actions from session captures: `medium` for implicit sources, `high` when stated explicitly with rationale.
