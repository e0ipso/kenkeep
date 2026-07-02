---
type: map
title: migrate command — schema v1 to v2 migration
description: >-
  The `migrate` command is the correct tool for migrating a knowledge base from
  schema v1 to v2.
tags:
  - kenkeep
  - migration
  - cli
kk_schema_version: 3
kk_id: map-migrate-command-schema-v1-to-v2-migration
kk_derived_from: []
kk_relates_to:
  - map-curate-command
  - map-node-frontmatter
kk_depends_on: []
kk_confidence: high
---
The `npx kenkeep --harness <id> migrate` command is the correct tool for migrating a knowledge base from the legacy flat `nodes/<kind>/` layout (schema v1) to the topical-folder tree layout (schema v2). It clusters flat leaves in-session and preserves every node's id and edges. The `migrate` command is hidden in the CLI (`hidden: true`). `init` and `init --upgrade` do not migrate nodes — they only refresh templates, prompts, and the version marker. The `--harness` flag is a global CLI option and must precede the subcommand (`npx kenkeep --harness <id> migrate`).

<!-- kk:related:start -->
# Related

- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-node-frontmatter](/node-schema/map-node-frontmatter.md)
<!-- kk:related:end -->
