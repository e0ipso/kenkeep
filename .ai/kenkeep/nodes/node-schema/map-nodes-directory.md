---
schema_version: 2
id: map-nodes-directory
title: nodes/ directory and the two kinds
kind: map
tags:
  - nodes
  - practice
  - map
  - frontmatter
  - schema
derived_from:
  - docs/how-it-works.md
  - docs/internals/schemas.md
relates_to:
  - map-node-frontmatter
  - map-kenkeep-directory
depends_on: []
confidence: high
summary: >-
  Knowledge nodes are markdown files in nested topical folders under nodes/;
  kind (practice/map) is a frontmatter facet, not a directory.
---

# `nodes/` directory and the two kinds

Every kept fact is a markdown file under `.ai/kenkeep/nodes/`, organized into nested **topical** folders at any depth (e.g. `cli/`, `harness/`, `knowledge-base/index/`). `kind` is a frontmatter **facet, not a directory**: it decides how a leaf renders in its folder's `index.md` (Conventions vs Components), never where the leaf lives.

The two kinds:

- **`practice`** — _how we build._ Imperative guidance: conventions, prohibitions, gotchas, decision rationale, tooling/workflow.
- **`map`** — _what exists._ Named things — modules, services, file-tree locations, project-specific vocabulary.

Filenames are `<id>.md`, where the `id` is `<kind>-<slug>` — so the kind appears in the filename and id, but never in the directory path. The filename and `id` must agree; the `lint` command rejects mismatches as errors. The old flat `nodes/<kind>/` bucket layout is rejected by the reader; migrate with `npx kenkeep --harness <id> migrate`.

When a piece of content has both aspects (e.g. "use `bravo_analytics.dispatcher`, our event-tracking service"), the proposal prompt splits combined statements: practice owns the imperative ("use the dispatcher"), map owns the entity ("what the dispatcher is").
