---
schema_version: 2
id: map-knowledge-pack-format
title: Knowledge pack format contract
kind: map
tags:
  - pack
  - schema
  - cli
derived_from:
  - https://github.com/e0ipso/kenkeep/issues/71
  - https://github.com/e0ipso/kenkeep/issues/74
  - src/lib/pack.ts
  - src/lib/schemas.ts
relates_to:
  - practice-pack-import-is-deterministic
  - practice-pack-id-collisions-skip-with-warning
  - practice-pack-export-stamps-schema-version
depends_on:
  - practice-strict-schema-version-bump-policy
confidence: high
summary: >-
  A knowledge pack root carries kenkeep-pack.yaml, README.md, and knowledge/;
  the manifest is validated by PackManifestSchema and knowledge/ is a nodes/
  shaped markdown tree.
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
