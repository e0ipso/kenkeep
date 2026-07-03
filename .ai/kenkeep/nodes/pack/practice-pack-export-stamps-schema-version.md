---
type: practice
title: Pack export stamps schema_version from NODE_SCHEMA_VERSION
description: >-
  pack export builds the manifest in code, setting schema_version from
  NODE_SCHEMA_VERSION before validating with PackManifestSchema.
tags:
  - pack
  - export
  - schema
kk_schema_version: 3
kk_id: practice-pack-export-stamps-schema-version
kk_derived_from:
  - 'https://github.com/e0ipso/kenkeep/issues/73'
  - 'https://github.com/e0ipso/kenkeep/issues/74'
  - src/commands/pack-export.ts
  - src/lib/schemas.ts
kk_relates_to:
  - map-knowledge-pack-format
  - practice-strict-schema-version-bump-policy
kk_depends_on:
  - map-knowledge-pack-format
kk_confidence: high
---

# Pack export stamps schema_version from NODE_SCHEMA_VERSION

`kenkeep pack export` never asks the user to provide `schema_version`. It builds
the manifest from the supplied or prompted fields, stamps `schema_version` from
`NODE_SCHEMA_VERSION`, and validates the result with `PackManifestSchema` before
writing `kenkeep-pack.yaml`.

This keeps the manifest aligned with the installed CLI's node reader. When the
node schema changes, the exported pack format follows the code constant instead
of relying on stale docs, copied examples, or interactive input.

<!-- kk:related:start -->
# Related

- Related: [map-knowledge-pack-format](/pack/map-knowledge-pack-format.md)
- Related: [practice-strict-schema-version-bump-policy](/node-schema/practice-strict-schema-version-bump-policy.md)
- Depends on: [map-knowledge-pack-format](/pack/map-knowledge-pack-format.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://github.com/e0ipso/kenkeep/issues/73](https://github.com/e0ipso/kenkeep/issues/73)
[2] [https://github.com/e0ipso/kenkeep/issues/74](https://github.com/e0ipso/kenkeep/issues/74)
[3] [src/commands/pack-export.ts](src/commands/pack-export.ts)
[4] [src/lib/schemas.ts](src/lib/schemas.ts)
<!-- kk:citations:end -->
