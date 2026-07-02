---
type: practice
title: Pack import is deterministic and leaves rebalance for later
description: >-
  pack import validates and grafts markdown with no LLM under one nodes/<name>/
  branch, rebuilds indexes; rebalance is left to curate.
tags:
  - pack
  - import
  - determinism
  - rebalance
kk_schema_version: 3
kk_id: practice-pack-import-is-deterministic
kk_derived_from:
  - 'https://github.com/e0ipso/kenkeep/issues/72'
  - 'https://github.com/e0ipso/kenkeep/issues/74'
  - src/commands/pack-import.ts
kk_relates_to:
  - map-knowledge-pack-format
  - practice-determinism-contract
  - practice-skills-first-documentation-only-init-is-cli
kk_depends_on:
  - map-knowledge-pack-format
kk_confidence: high
---

# Pack import is deterministic and leaves rebalance for later

`kenkeep pack import <source>` is a deterministic CLI workflow for moving
already-reviewed knowledge between repositories. Source acquisition may read a
local `.tar.gz` or download a GitHub tarball, but the pack operation itself does
not invoke a harness, LLM, or skill.

After validation, import copies markdown from `knowledge/` into one isolated
destination branch, `nodes/<name>/`, where `<name>` comes from the manifest or
`--as`. It then runs `index rebuild` so `ENTRY.md`, `GRAPH.md`, and folder
indexes match the grafted tree.

Import deliberately does not rebalance or interleave the pack with local topics.
The imported branch stays reviewable as a single unit. If the project later needs
the pack split, merged, or relocated, that happens through the normal
`/kk-curate` rebalance phase and is accepted or rejected through the usual git
review.

<!-- kk:related:start -->
# Related

- Related: [map-knowledge-pack-format](/pack/map-knowledge-pack-format.md)
- Related: [practice-determinism-contract](/index/practice-determinism-contract.md)
- Related: [practice-skills-first-documentation-only-init-is-cli](/cli/practice-skills-first-documentation-only-init-is-cli.md)
- Depends on: [map-knowledge-pack-format](/pack/map-knowledge-pack-format.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://github.com/e0ipso/kenkeep/issues/72](https://github.com/e0ipso/kenkeep/issues/72)
[2] [https://github.com/e0ipso/kenkeep/issues/74](https://github.com/e0ipso/kenkeep/issues/74)
[3] [src/commands/pack-import.ts](src/commands/pack-import.ts)
<!-- kk:citations:end -->
