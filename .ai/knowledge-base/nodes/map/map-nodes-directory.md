---
schema_version: 1
id: map-nodes-directory
title: "nodes/ directory and the two kinds"
kind: map
tags: [nodes, practice, map, frontmatter, schema]
derived_from:
  - docs/how-it-works.md
  - docs/internals/schemas.md
relates_to:
  - map-node-frontmatter
  - map-knowledge-base-directory
depends_on: []
confidence: high
summary: "Knowledge nodes live as markdown under nodes/{practice,map}/<id>.md. Two kinds: practice (how we build) and map (what exists)."
---

# `nodes/` directory and the two kinds

Every kept fact is a markdown file under `.ai/knowledge-base/nodes/` with YAML frontmatter. The directory has exactly two subdirectories, one per kind:

- **`nodes/practice/`** — _how we build._ Imperative guidance: conventions, prohibitions, gotchas, decision rationale, tooling/workflow.
- **`nodes/map/`** — _what exists._ Named things — modules, services, file-tree locations, project-specific vocabulary.

Filenames are `<kind>-<slug>.md`, where the slug also appears in the file's `id:` frontmatter as `<kind>-<slug>`. The kind in the path, filename, and id must all agree; the `lint` command rejects mismatches as errors.

When a piece of content has both aspects (e.g. "use `bravo_analytics.dispatcher`, our event-tracking service"), the proposal prompt splits combined statements: practice owns the imperative ("use the dispatcher"), map owns the entity ("what the dispatcher is").
