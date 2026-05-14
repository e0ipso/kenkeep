---
schema_version: 1
id: practice-zod-validation-at-read
title: "Every YAML/JSON shape is validated by Zod at read time"
kind: practice
tags: [zod, schema, validation]
derived_from:
  - docs/internals/schemas.md
relates_to: []
confidence: high
summary: "Frontmatter and state files are parsed through Zod schemas in src/lib/schemas.ts; malformed files are silently dropped (or hard-errored, depending on site)."
---

# Every YAML/JSON shape is validated by Zod at read time

`src/lib/schemas.ts` is the source of truth for every frontmatter and JSON state shape: `NodeFrontmatterSchema`, `SessionLogFrontmatterSchema`, `ProposalOutputSchema`, `ProposalCandidateSchema`, `BootstrapCandidateSchema`, `CuratorOutputSchema`, `IndexFrontmatterSchema`, `GraphFrontmatterSchema`, `PendingConflictsFileSchema`, `StateFileSchema`, `BootstrapStateSchema`.

A schema mismatch is a parse failure. Different sites handle the failure differently:

- Node files with mismatched frontmatter: silently dropped from the consume path; `doctor --verbose` flags them.
- `config.yaml` with unknown keys: hard error naming the file (see [[practice-strict-config-yaml-schema]]).
- Curator / proposal stream-JSON output: parse failure is reported in the run summary and the action is treated as a failure.

**How to apply:**

- New on-disk shapes go through `src/lib/schemas.ts`. Don't hand-parse YAML/JSON in commands or hooks.
- Documentation in `docs/internals/schemas.md` is a *mirror* of the code; when the two disagree, the code wins. Update the doc when bumping the schema.
- When the shape changes, see [[practice-no-migrators-clean-schema-break]] for the bump policy.
