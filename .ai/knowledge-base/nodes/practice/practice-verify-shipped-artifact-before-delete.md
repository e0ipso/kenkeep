---
schema_version: 1
id: practice-verify-shipped-artifact-before-delete
title: Verify shipped-artifact status before deleting tracked files
kind: practice
tags:
  - safety
  - destructive-actions
  - verification
derived_from:
  - 20260512-1439-722a03fa9cbe.md
relates_to:
  - practice-do-not-commit-bundled-output
  - map-templates-npm-artifact
depends_on: []
confidence: high
summary: >-
  Before removing tracked files, check whether they are part of the npm shipped
  artifact (package.json "files") or referenced by CLI init.
---
When asked to delete tracked files that look like build output, first verify: (1) whether the directory is listed in `package.json` `"files"` (shipped to npm), (2) whether any CLI command (e.g. `init`) copies from that location at runtime, and (3) whether a `prepublishOnly` or equivalent hook regenerates the directory before publish.

Only after confirming regeneration is automatic and nothing reads the tracked copy at runtime is it safe to untrack and gitignore.
