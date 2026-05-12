---
schema_version: 1
id: practice-prompt-versioning
title: "Bump the Version: N comment on every prompt behavior change"
kind: practice
tags: [prompts, versioning, changelog]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - CONTRIBUTING.md
  - docs/internals/prompts.md
relates_to: []
depends_on: []
confidence: high
summary: "Every shipped prompt file has a Version: N comment. Bump it whenever you change behavior, and note the change in the changelog."
---

# Bump the Version: N comment on every prompt behavior change

Each `src/templates-source/prompts/*.md` and `src/templates-source/claude/commands/*.md` carries a top-of-file `Version: N` comment. Bump it whenever you change behavior. Logs record the prompt content so historic decisions stay auditable.

Prompt version is independent of the npm package version, but a prompt change must be noted in the changelog so users know to inspect the diff. To revert a local override, the consumer deletes the file under `.ai/knowledge-base/.config/prompts/`.
