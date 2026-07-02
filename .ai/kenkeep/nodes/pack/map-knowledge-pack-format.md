---
type: map
title: Knowledge pack format contract
description: >-
  A pack root has kenkeep-pack.yaml, README.md, knowledge/; PackManifestSchema
  validates the manifest; knowledge/ is a nodes/-shaped tree.
tags:
  - pack
  - schema
  - cli
kk_schema_version: 3
kk_id: map-knowledge-pack-format
kk_derived_from:
  - 'https://github.com/e0ipso/kenkeep/issues/71'
  - 'https://github.com/e0ipso/kenkeep/issues/74'
  - src/lib/pack.ts
  - src/lib/schemas.ts
kk_relates_to:
  - practice-pack-import-is-deterministic
  - practice-pack-id-collisions-skip-with-warning
  - practice-pack-export-stamps-schema-version
kk_depends_on:
  - practice-strict-schema-version-bump-policy
kk_confidence: high
---

# Knowledge pack format contract

A publishable knowledge pack has exactly one root manifest named
`kenkeep-pack.yaml`, an optional-for-import `README.md`, and a `knowledge/`
directory containing a kenkeep `nodes/`-style tree.

`PackManifestSchema` validates:

- `name`: lowercase slug matching `^[a-z0-9][a-z0-9-]*$`.
- `version`: non-empty string.
- `schema_version`: literal `NODE_SCHEMA_VERSION` for the installed CLI.
- `summary`: non-empty one-line description.
- `homepage`: optional URL.

`validatePack` rejects missing or malformed manifests, schema-version
mismatches, missing `knowledge/`, invalid node frontmatter, node naming errors,
and duplicate node ids inside the pack. It treats `README.md` as human-facing
pack documentation; import reads only `knowledge/`.

<!-- kk:related:start -->
# Related

- Related: [practice-pack-import-is-deterministic](/pack/practice-pack-import-is-deterministic.md)
- Related: [practice-pack-id-collisions-skip-with-warning](/pack/practice-pack-id-collisions-skip-with-warning.md)
- Related: [practice-pack-export-stamps-schema-version](/pack/practice-pack-export-stamps-schema-version.md)
- Depends on: [practice-strict-schema-version-bump-policy](/node-schema/practice-strict-schema-version-bump-policy.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [https://github.com/e0ipso/kenkeep/issues/71](https://github.com/e0ipso/kenkeep/issues/71)
[2] [https://github.com/e0ipso/kenkeep/issues/74](https://github.com/e0ipso/kenkeep/issues/74)
[3] [src/lib/pack.ts](src/lib/pack.ts)
[4] [src/lib/schemas.ts](src/lib/schemas.ts)
<!-- kk:citations:end -->
