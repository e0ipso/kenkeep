---
schema_version: 1
id: practice-atomic-prs-with-paired-docs
title: "One logical change per PR, with the docs update for that change"
kind: practice
tags: [git, pr, review, docs]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - CONTRIBUTING.md
relates_to: []
depends_on: []
confidence: high
summary: "Branch from main. One logical change per PR. Include doc updates for the phase you're touching. Run npm test, typecheck, and lint before pushing."
---

# One logical change per PR, with the docs update for that change

- One logical change per PR. Branch from `main`.
- Include doc updates for the phase you're touching. The per-phase doc distribution is recorded in `IMPLEMENTATION.md` (verify the actual phase against current code before relying on it).
- Run `npm test`, `npm run typecheck`, and `npm run lint` before pushing.
- Conventional Commit format on both commit messages and the PR title.

The pre-commit hook (`husky` + `lint-staged`) already runs ESLint, Prettier, and secretlint on staged files, followed by `typecheck` and `test` across the project. CI then re-runs the same checks plus releases on merge to `main`.
