---
type: practice
title: Pack id collisions skip with a warning
description: >-
  pack import follows the bootstrap safety rule: a leaf whose id already exists
  in the consumer repo is skipped and reported, never merged.
tags:
  - pack
  - import
  - nodes
  - safety
kk_schema_version: 3
kk_id: practice-pack-id-collisions-skip-with-warning
kk_derived_from:
  - 'https://github.com/e0ipso/kenkeep/issues/72'
  - 'https://github.com/e0ipso/kenkeep/issues/74'
  - src/commands/pack-import.ts
kk_relates_to:
  - map-knowledge-pack-format
  - practice-bootstrap-never-overwrites-existing-nodes
kk_depends_on:
  - practice-bootstrap-never-overwrites-existing-nodes
kk_confidence: high
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

<!-- kk:related:start -->
# Related

- Related: [map-knowledge-pack-format](/pack/map-knowledge-pack-format.md)
- Related: [practice-bootstrap-never-overwrites-existing-nodes](/bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md)
- Depends on: [practice-bootstrap-never-overwrites-existing-nodes](/bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://github.com/e0ipso/kenkeep/issues/72](https://github.com/e0ipso/kenkeep/issues/72)
[2] [https://github.com/e0ipso/kenkeep/issues/74](https://github.com/e0ipso/kenkeep/issues/74)
[3] [src/commands/pack-import.ts](src/commands/pack-import.ts)
<!-- kk:citations:end -->
