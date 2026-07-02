---
type: practice
title: Bootstrap never overwrites existing nodes
description: >-
  Both /kk-bootstrap and bootstrap-incremental skip a candidate when a node with
  that id already exists; collisions are reported, not merged.
tags:
  - bootstrap
  - nodes
  - safety
kk_schema_version: 3
kk_id: practice-bootstrap-never-overwrites-existing-nodes
kk_derived_from:
  - docs/installation.md
  - docs/daily-use.md
  - src/templates-source/skills/kk-bootstrap/SKILL.md
kk_relates_to:
  - map-kk-bootstrap-skill
  - map-bootstrap-incremental-command
kk_depends_on: []
kk_confidence: high
---

# Bootstrap never overwrites existing nodes

Both the `/kk-bootstrap` skill and the `bootstrap-incremental` CLI are **conservative**: if a candidate would write to a node id that already exists on disk, they skip the candidate and report the collision. Neither attempts to merge.

**Why:** bootstrap is a one-shot seeding operation against unvetted source docs. Overwriting a committed, human-reviewed node with an auto-extracted candidate would silently undo earlier review decisions. The conservative rule keeps `nodes/` strictly append-only during bootstrap; refinement happens later through the curator's `modify` action, which is reviewed per-conflict.

**How to apply:** when writing or extending a bootstrap-style flow, check for an existing node file before writing and skip on collision. If two source docs converge on the same node, list both in `derived_from` of a single node rather than producing two competing files.

<!-- kk:related:start -->
# Related

- Related: [map-kk-bootstrap-skill](/bootstrap/map-kk-bootstrap-skill.md)
- Related: [map-bootstrap-incremental-command](/bootstrap/map-bootstrap-incremental-command.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/daily-use.md](docs/daily-use.md)
[3] [src/templates-source/skills/kk-bootstrap/SKILL.md](src/templates-source/skills/kk-bootstrap/SKILL.md)
<!-- kk:citations:end -->
