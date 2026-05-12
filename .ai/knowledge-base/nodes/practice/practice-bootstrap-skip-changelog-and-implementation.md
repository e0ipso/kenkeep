---
schema_version: 1
id: practice-bootstrap-skip-changelog-and-implementation
title: Skip CHANGELOG.md and treat IMPLEMENTATION.md as suspect during bootstrap
kind: practice
tags:
  - bootstrap
  - kb
  - docs
  - scope
valid_from: '2026-05-12T09:59:17.929Z'
valid_until: null
updated: '2026-05-12T11:48:24.252Z'
supersedes: null
superseded_by: null
derived_from:
  - 20260512-0959-f963bf78b135.md
relates_to:
  - map-project-documentation-layout
  - practice-no-schema-migrators
depends_on: []
confidence: high
summary: >-
  Bootstrap skips CHANGELOG.md and never sources a node from IMPLEMENTATION.md
  alone; verify claims against src/ or current docs.
---
When running `/kb-bootstrap` over existing project docs, exclude:

- `CHANGELOG.md` (history, not current design)
- `node_modules/**`
- `.ai/knowledge-base/_sessions/*` (raw capture, not authored docs)
- `.ai/knowledge-base/.config/prompts/*.md` (bundled prompt assets)
- `.ai/task-manager/` templates (out of scope for the KB)

`IMPLEMENTATION.md` is treated as potentially stale or aspirational. Never source a node solely from it. Every technical claim taken from `IMPLEMENTATION.md` must be cross-checked against `src/` or a current-design doc (`docs/`, `README.md`, `CONTRIBUTING.md`) before being written as a node.

See [[map-project-documentation-layout]] for the full doc inventory and [[practice-no-schema-migrators]] for an example where `CONTRIBUTING.md` framing wins over `IMPLEMENTATION.md` framing.
