---
schema_version: 2
id: practice-pack-import-is-deterministic
title: Pack import is deterministic and leaves rebalance for later
kind: practice
tags:
  - pack
  - import
  - determinism
  - rebalance
derived_from:
  - https://github.com/e0ipso/kenkeep/issues/72
  - https://github.com/e0ipso/kenkeep/issues/74
  - src/commands/pack-import.ts
relates_to:
  - map-knowledge-pack-format
  - practice-determinism-contract
  - practice-skills-first-documentation-only-init-is-cli
depends_on:
  - map-knowledge-pack-format
confidence: high
summary: >-
  pack import validates and grafts reviewed markdown without an LLM, keeps the
  pack under one nodes/<name>/ branch, rebuilds indexes, and leaves structural
  rebalance to the later curate phase.
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
