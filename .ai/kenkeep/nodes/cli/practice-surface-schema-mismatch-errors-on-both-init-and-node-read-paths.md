---
type: practice
title: Surface schema mismatch errors on both init and node-read paths
description: >-
  Migration schema mismatch errors must be visible both when init runs and when
  node-reading commands execute.
tags:
  - kenkeep
  - migration
  - schema
  - error
  - cli
kk_schema_version: 3
kk_id: practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths
kk_derived_from: []
kk_relates_to:
  - practice-strict-schema-version-bump-policy
  - map-node-frontmatter
kk_depends_on: []
kk_confidence: high
---
When a knowledge base uses an older schema version (e.g., the legacy v1 flat `nodes/<kind>/` layout), the mismatch must be surfaced to the user on both paths: (1) when `init` or `init --upgrade` runs against the repo, and (2) when any node-reading command (`doctor`, `index-rebuild`, `lint`, `curate`, `node write`, etc.) executes. The `init` path is a loud `log.error` but non-fatal (exit 0), because `init`/`upgrade` did their job of refreshing templates; the migration itself is a deliberate, harness-backed follow-up. The node-read path throws `OldLayoutError` with a message pointing to the correct migration command. The error must never point to `init --upgrade` (which does not migrate nodes) or to deleting the `nodes/` tree (data loss).

<!-- kk:related:start -->
# Related

- Related: [practice-strict-schema-version-bump-policy](/node-schema/practice-strict-schema-version-bump-policy.md)
- Related: [map-node-frontmatter](/node-schema/map-node-frontmatter.md)
<!-- kk:related:end -->
