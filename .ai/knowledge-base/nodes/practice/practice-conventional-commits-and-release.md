---
schema_version: 1
id: practice-conventional-commits-and-release
title: "Conventional Commits drive semantic-release"
kind: practice
tags: [git, release, conventional-commits]
derived_from:
  - CONTRIBUTING.md
relates_to: []
depends_on: []
confidence: high
summary: "Releases are automated via semantic-release on merge to main. Commit type (feat/fix/etc.) determines version bump; no manual tag or npm publish."
---

# Conventional Commits drive semantic-release

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/). Conventional Commits message format on commits and PR titles (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`) determines the next version and the changelog entry. Merging to `main` triggers the release pipeline; no manual tagging, no manual `npm publish`.

**Why:** the package ships frequent, low-risk changes (prompt tweaks, adapter fixes). Automated release-on-merge keeps the friction low so improvements actually ship; the Conventional Commits convention keeps the changelog honest without a human curating it.

**How to apply:**

- Every commit/PR title must use a valid Conventional Commits type. The local `commitlint.config.cjs` enforces this on commit messages.
- One logical change per PR; branch from `main`.
- Doc updates ship in the same PR as the code change.
- Run `npm test`, `npm run typecheck`, and `npm run lint` before pushing.
- Behavior-affecting prompt changes get a `Version: N` bump and a changelog note (see `practice-bump-prompt-version-comment`).
