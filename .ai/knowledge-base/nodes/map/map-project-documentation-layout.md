---
schema_version: 1
id: map-project-documentation-layout
title: Project documentation layout
kind: map
tags:
  - docs
  - directory-layout
  - bootstrap
valid_from: '2026-05-12T09:59:17.929Z'
valid_until: null
updated: '2026-05-12T11:48:24.254Z'
supersedes: null
superseded_by: null
derived_from:
  - 20260512-0959-f963bf78b135.md
relates_to:
  - practice-bootstrap-skip-changelog-and-implementation
depends_on: []
confidence: high
summary: >-
  Docs live at repo root (README, CONTRIBUTING, PRD, IMPLEMENTATION, CHANGELOG)
  plus docs/ (user-facing) and docs/internals/ (developer-facing).
---
Project documentation is laid out as follows:

- **Repo-root markdown**
  - `README.md`
  - `CONTRIBUTING.md`
  - `PRD.md` (~242 lines)
  - `IMPLEMENTATION.md` (~996 lines)
  - `CHANGELOG.md`
- **`docs/`** (user-facing)
  - `index.md`, `installation.md`, `how-it-works.md`, `daily-use.md`, `cli-reference.md`, `troubleshooting.md`
- **`docs/internals/`** (developer-facing)
  - `index.md` (hub), `architecture.md`, `prompts.md`, `schemas.md`, `hooks.md`, `manual-test-plan.md`

`docs/internals/index.md` advertises itself as the hub for the internals docs.

See [[practice-bootstrap-skip-changelog-and-implementation]] for which of these the KB bootstrap treats as authoritative vs suspect.
