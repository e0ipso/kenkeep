---
schema_version: 1
id: practice-bump-prompt-version-comment
title: "Bump the prompt's Version comment on every behavior change"
kind: practice
tags: [prompts, versioning, audit]
derived_from:
  - docs/internals/prompts.md
  - docs/troubleshooting.md
  - CONTRIBUTING.md
relates_to:
  - practice-local-prompt-overrides-fall-back-to-bundled
depends_on: []
confidence: high
summary: "Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record the prompt so audits remain coherent."
---

# Bump the prompt's `Version:` comment on every behavior change

Every `src/templates-source/prompts/*.md` (and the equivalent skill commands) carries a top-of-file `Version: N` comment. Bump it whenever you change behavior — even a small reword that affects extraction quality.

**Why:** the LLM pipelines write a stream-JSON trace to `_logs/` that includes the prompt content. Bumping the version is what lets a future investigator answer "which prompt produced this candidate?" The version is independent of the npm package version, but a prompt change must be noted in the changelog so users know to inspect the diff.

**How to apply:**

- Behavior changes (rewording skip rules, adding examples, tightening output schema description) → bump the version.
- Pure typo fixes or formatting changes that cannot affect model output → no bump required, but document in commit message.
- When deploying via `init --upgrade`, sentinel comments and local overrides are preserved; the upgrade refreshes only the bundled fallback. If a user has a local override, they need to merge in the new version themselves.
