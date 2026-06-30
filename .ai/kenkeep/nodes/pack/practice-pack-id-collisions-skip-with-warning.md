---
schema_version: 2
id: practice-pack-id-collisions-skip-with-warning
title: Pack id collisions skip with a warning
kind: practice
tags:
  - pack
  - import
  - nodes
  - safety
derived_from:
  - https://github.com/e0ipso/kenkeep/issues/72
  - https://github.com/e0ipso/kenkeep/issues/74
  - src/commands/pack-import.ts
relates_to:
  - map-knowledge-pack-format
  - practice-bootstrap-never-overwrites-existing-nodes
depends_on:
  - practice-bootstrap-never-overwrites-existing-nodes
confidence: high
summary: >-
  pack import follows the bootstrap safety rule: a leaf whose id already exists
  in the consumer repo is skipped, reported, and never merged or overwritten.
---

# Pack id collisions skip with a warning

When importing a pack, node id collisions are conservative. If a leaf in the
pack has an id that already exists anywhere in the consumer repo's current
`nodes/` tree, import skips that leaf and prints a warning listing the skipped
ids.

The rule matches bootstrap: never overwrite reviewed local knowledge during an
intake flow. Import does not attempt automatic collision resolution, merging, or
renaming. A human can later compare the skipped pack node with the local node and
decide whether a curated `modify` action or a hand-authored replacement is
appropriate.
