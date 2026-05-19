---
schema_version: 1
id: practice-strict-schema-version-bump-policy
title: "Strict schema-version bump policy: no migrators"
kind: practice
tags: [schema, versioning, breaking-change]
derived_from:
  - CONTRIBUTING.md
  - docs/internals/schemas.md
relates_to:
  - map-node-frontmatter
depends_on: []
confidence: high
summary: "On-disk shapes carry schema_version. Breaking changes get a clean break (no migrators, no shims); the reader rejects mismatches and directs the user to re-init."
---

# Strict schema-version bump policy: no migrators

Every frontmatter and JSON state file in the system carries a `schema_version` integer. The policy is **strict**: any breaking change to the on-disk shape gets a clean break — no migrators, no compatibility shims, no legacy code paths. Users on the old shape re-initialize.

Concretely:

- **Bump** when: removing a field; renaming a field; changing the semantics of a field; making a previously-optional field required.
- **Do not bump** when: adding an optional field; adding a new enum case; relaxing a constraint.

When the version is bumped, readers reject older files with a clear error directing the user to re-run `init`. **Do not write a migrator.**

**Why:** the KB is per-repo and short-lived in any single user's working copy; the population is small and re-init is cheap. Migrators add code paths that have to be tested forever and tend to silently paper over genuinely-breaking semantic changes.

**How to apply:**

- A schema mismatch on read is a parse failure — the file is dropped or surfaced as an error depending on the reader.
- Tests must pin both the current shape and the rejection path for older shapes.
- Note the bump in the changelog so users know to re-run `init`.
