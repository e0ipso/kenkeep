---
schema_version: 1
id: practice-no-migrators-clean-schema-break
title: "Schema bumps are a clean break; no migrators, no shims"
kind: practice
tags: [schema, versioning, prohibition]
derived_from:
  - CONTRIBUTING.md
  - PRD.md
relates_to: []
confidence: high
summary: "Breaking changes to on-disk shapes get a clean break: readers reject older shapes; users re-init. No migrators ship."
---

# Schema bumps are a clean break; no migrators, no shims

Every frontmatter and JSON state file carries `schema_version: N`. The policy is **strict**: any breaking change to the on-disk shape gets a clean break.

- **Bump `schema_version`** when removing a field, renaming a field, changing the semantics of a field, or making a previously-optional field required.
- **Do not bump** when adding an optional field, adding a new enum case, or relaxing a constraint.

**Why:** schema migration tooling is permanently out of scope. `schema_version` exists to *fail loudly* on incompatible reads, not to feed a migrator. The PRD makes this explicit: no migrators, no compatibility shims, and no legacy code paths ship in any version.

**How to apply:** when you bump, the reader rejects v(N-1) files with a clear error directing the user to re-run `init`. Do not write a migrator. Users re-initialize on schema bumps; the changelog calls it out.
