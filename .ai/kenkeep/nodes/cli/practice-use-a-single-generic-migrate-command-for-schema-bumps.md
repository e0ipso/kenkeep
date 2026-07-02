---
type: practice
title: Use a single generic migrate command for schema bumps
description: >-
  One generic migrate command detects the current schema and dispatches the
  right step, rather than separate commands per bump.
tags:
  - migration
  - cli
  - schema
kk_schema_version: 3
kk_id: practice-use-a-single-generic-migrate-command-for-schema-bumps
kk_derived_from: []
kk_relates_to:
  - practice-strict-schema-version-bump-policy
  - map-node-frontmatter
kk_depends_on: []
kk_confidence: high
---
The project uses a single `migrate` command for all schema bumps. The command reads the on-disk schema version, compares it to the code's target version, and runs the matching step(s) from a registry. This allows future schema bumps to append one entry to the registry rather than adding a new command.

<!-- kk:related:start -->
# Related

- Related: [practice-strict-schema-version-bump-policy](/node-schema/practice-strict-schema-version-bump-policy.md)
- Related: [map-node-frontmatter](/node-schema/map-node-frontmatter.md)
<!-- kk:related:end -->
