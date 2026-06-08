---
schema_version: 2
id: practice-strict-schema-version-bump-policy
title: Strict schema-version bump policy
kind: practice
tags:
  - schema
  - versioning
  - breaking-change
derived_from:
  - CONTRIBUTING.md
  - docs/internals/schemas.md
relates_to:
  - map-node-frontmatter
depends_on: []
confidence: high
summary: >-
  On-disk shapes carry schema_version. Breaking changes get a clean break:
  readers reject mismatches and direct users to re-init, with no compatibility
  shims or legacy read paths. A hidden, supervised `migrate` command is the one
  escape-hatch for crossing breaking layout bumps without re-init; it is
  deliberately unpublicized.
---

# Strict schema-version bump policy

Every frontmatter and JSON state file in the system carries a `schema_version` integer. The policy is **strict**: any breaking change to the on-disk shape gets a clean break in the readers — no compatibility shims, no legacy read paths. The reader rejects mismatches and directs the user to re-initialize.

Concretely:

- **Bump** when: removing a field; renaming a field; changing the semantics of a field; making a previously-optional field required.
- **Do not bump** when: adding an optional field; adding a new enum case; relaxing a constraint.

When the version is bumped, readers reject older files with a clear error directing the user to re-run `init`. Keep the readers free of legacy compatibility branches.

**Escape-hatch (unpublicized):** a hidden `migrate` command crosses breaking layout bumps for an existing knowledge base when re-init would strand curated content. It reads the on-disk schema, runs the matching step(s) up to the current storage schema, then stops for review (`git diff` to inspect, commit to accept, restore to reject). It is a one-time, supervised transform — not a runtime shim and not a legacy read path — and is kept out of `--help` and the docs on purpose. A new breaking layout bump adds one step (from→to) to its registry rather than a new command.

**Why:** keeping the readers free of legacy branches stops genuinely-breaking semantic changes from being silently papered over, and keeps the hot read path simple. The escape-hatch is deliberately separate from the readers: it transforms artifacts once, under human review, instead of carrying compatibility code forever.

**How to apply:**

- A schema mismatch on read is a parse failure — the file is dropped or surfaced as an error depending on the reader. Do not add a compatibility branch to a reader.
- Tests must pin both the current shape and the rejection path for older shapes.
- Note the bump in the changelog so users know to re-run `init`.
- When a layout bump would strand curated content, add a `migrate` step rather than a new top-level command, and keep it unpublicized.
