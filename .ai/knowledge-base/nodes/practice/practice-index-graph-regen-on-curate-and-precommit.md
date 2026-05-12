---
schema_version: 1
id: practice-index-graph-regen-on-curate-and-precommit
title: INDEX.md and GRAPH.md regenerate only on curate and pre-commit
kind: practice
tags:
  - kb
  - index
  - graph
  - commit-workflow
  - lint-staged
valid_from: '2026-05-12T09:59:17.929Z'
valid_until: null
updated: '2026-05-12T11:48:24.254Z'
supersedes: null
superseded_by: null
derived_from:
  - 20260512-0959-f963bf78b135.md
relates_to:
  - map-index-and-graph-files
  - practice-determinism-contract
  - practice-no-llm-pipelines-in-ci
depends_on: []
confidence: high
summary: >-
  INDEX/GRAPH regen at the end of curate and via lint-staged pre-commit on
  nodes/ changes; bootstrap never regenerates them.
---
`INDEX.md` and `GRAPH.md` regenerate at exactly two moments:

1. **End of a `curate` run.** The curator regenerates both files inline as its last step, against the post-curation `nodes/` tree.
2. **Pre-commit via lint-staged.** Any change under `.ai/knowledge-base/nodes/` triggers `ai-knowledge-base index rebuild --stage`, which writes fresh `INDEX.md` and `GRAPH.md` and stages them into the same commit. `--stage` no-ops when `nodes_hash` already matches the live tree.

`/kb-bootstrap` deliberately does not regenerate these files. New node files sit as a review queue for `git diff`, and the index is only updated for nodes the human actually accepts via `git commit`. To preview the index before committing, run `npx @e0ipso/ai-knowledge-base index rebuild` manually.

See [[map-index-and-graph-files]] for the artifacts themselves and [[practice-determinism-contract]] for why this regeneration is pure.
