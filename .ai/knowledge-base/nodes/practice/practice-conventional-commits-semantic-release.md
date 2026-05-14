---
schema_version: 1
id: practice-conventional-commits-semantic-release
title: "Conventional Commits drive semantic-release"
kind: practice
tags: [commits, release, format]
derived_from:
  - CONTRIBUTING.md
relates_to: []
confidence: high
summary: "Releases are automated by semantic-release; conventional commit messages determine version and changelog. Merging to main triggers the pipeline."
---

# Conventional Commits drive semantic-release

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/). Conventional commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`) determine the next version and changelog entry. Merging to `main` triggers the release pipeline; **no manual tagging or `npm publish` is needed**.

**Why:** the package targets per-repo install via `npx`; releases need to be cheap and unambiguous. Conventional commits also serve as the input to the auto-generated CHANGELOG, which users read to spot prompt-version bumps and schema bumps.

**How to apply:**

- Commit messages and PR titles use conventional commit format.
- Use `feat:` only for user-visible additions; `fix:` for user-visible fixes; refactors, tests, and docs use the lower-impact prefixes.
- Don't tag or publish by hand. If a release didn't fire on merge, investigate the pipeline, don't reach for `npm publish`.
- One logical change per PR; doc updates for the phase you're touching go in the same PR.
