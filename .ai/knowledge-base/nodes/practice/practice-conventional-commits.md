---
schema_version: 1
id: practice-conventional-commits
title: "Conventional Commits are required: they drive the release"
kind: practice
tags: [git, releases, commits, semantic-release]
derived_from:
  - CONTRIBUTING.md
relates_to: []
depends_on: []
confidence: high
summary: "Releases are automated via semantic-release. Conventional commit messages (feat:, fix:, refactor:, docs:, test:, chore:) determine version and changelog."
---

# Conventional Commits are required: they drive the release

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/). Conventional commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`) determine the next version and changelog entry. Merging to `main` triggers the release pipeline; no manual tagging or `npm publish` is needed.

Commit messages and PR titles both use Conventional Commit format. `commitlint.config.cjs` enforces the format on every commit.
