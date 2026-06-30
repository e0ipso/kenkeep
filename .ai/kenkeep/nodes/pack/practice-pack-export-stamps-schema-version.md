---
schema_version: 2
id: practice-pack-export-stamps-schema-version
title: Pack export stamps schema_version from NODE_SCHEMA_VERSION
kind: practice
tags:
  - pack
  - export
  - schema
derived_from:
  - https://github.com/e0ipso/kenkeep/issues/73
  - https://github.com/e0ipso/kenkeep/issues/74
  - src/commands/pack-export.ts
  - src/lib/schemas.ts
relates_to:
  - map-knowledge-pack-format
  - practice-strict-schema-version-bump-policy
depends_on:
  - map-knowledge-pack-format
confidence: high
summary: >-
  pack export builds the manifest in code and always sets schema_version from
  NODE_SCHEMA_VERSION before validating it with PackManifestSchema.
---

# Pack export stamps schema_version from NODE_SCHEMA_VERSION

`kenkeep pack export` never asks the user to provide `schema_version`. It builds
the manifest from the supplied or prompted fields, stamps `schema_version` from
`NODE_SCHEMA_VERSION`, and validates the result with `PackManifestSchema` before
writing `kenkeep-pack.yaml`.

This keeps the manifest aligned with the installed CLI's node reader. When the
node schema changes, the exported pack format follows the code constant instead
of relying on stale docs, copied examples, or interactive input.
