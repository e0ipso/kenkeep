---
schema_version: 1
id: practice-no-schema-migrators
title: "Strict schema-version policy: clean break, no migrators"
kind: practice
tags: [schema, versioning, policy, no-legacy]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - CONTRIBUTING.md
relates_to: [map-zod-schemas]
depends_on: []
confidence: high
summary: "Every on-disk shape carries schema_version: 1. Bumps are a clean break: no migrators, no compat shims, no legacy paths."
---

# Strict schema-version policy: clean break, no migrators

Every frontmatter and JSON state file in the system carries `schema_version: 1`. The policy is strict: any breaking change to the on-disk shape gets a clean break. There are no migrators, no compatibility shims, and no legacy code paths. Users on the old shape re-initialize.

**Bump `schema_version: 1 → 2`** when removing a field, renaming a field, changing the semantics of a field, or making a previously-optional field required.

**Do not bump** when adding an optional field, adding a new enum case, or relaxing a constraint.

When you bump, the reader rejects v1 files with a clear error directing the user to re-run `init`. Do not write a migrator. Schema migration tooling is permanently out of scope: `schema_version` exists to fail loudly on incompatible reads, not to feed a migrator.
