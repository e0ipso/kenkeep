---
schema_version: 1
id: practice-bootstrap-never-overwrites-existing-nodes
title: "Bootstrap never overwrites existing nodes"
kind: practice
tags: [bootstrap, nodes, safety]
derived_from:
  - docs/installation.md
  - docs/daily-use.md
  - docs/cli-reference.md
  - .claude/skills/kb-bootstrap/SKILL.md
relates_to:
  - map-kb-bootstrap-skill
  - map-bootstrap-incremental-command
depends_on: []
confidence: high
summary: "Both /kb-bootstrap and bootstrap-incremental skip a candidate when a node with that id already exists; collisions are reported, not merged."
---

# Bootstrap never overwrites existing nodes

Both the `/kb-bootstrap` skill and the `bootstrap-incremental` CLI are **conservative**: if a candidate would write to a node id that already exists on disk, they skip the candidate and report the collision. Neither attempts to merge.

**Why:** bootstrap is a one-shot seeding operation against unvetted source docs. Overwriting a committed, human-reviewed node with an auto-extracted candidate would silently undo earlier review decisions. The conservative rule keeps `nodes/` strictly append-only during bootstrap; refinement happens later through the curator's `modify` action, which is reviewed per-conflict.

**How to apply:** when writing or extending a bootstrap-style flow, check for an existing node file before writing and skip on collision. If two source docs converge on the same node, list both in `derived_from` of a single node rather than producing two competing files.
