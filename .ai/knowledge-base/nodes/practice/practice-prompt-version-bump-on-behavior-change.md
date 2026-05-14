---
schema_version: 1
id: practice-prompt-version-bump-on-behavior-change
title: "Bump prompt Version: on every behavior change"
kind: practice
tags: [prompts, versioning, llm]
derived_from:
  - CONTRIBUTING.md
  - docs/internals/prompts.md
relates_to: []
confidence: high
summary: "Every src/templates-source prompt carries a Version: N comment; bump it on behavior changes and call it out in the changelog."
---

# Bump prompt `Version:` on every behavior change

Each `src/templates-source/prompts/*.md` and `src/templates-source/claude/commands/*.md` carries a top-of-file `Version: N` comment. Bump the version when you change behavior.

**Why:** prompt version is independent of the npm package version, but logs record the prompt content so historic decisions stay auditable. Users with local overrides (under `.ai/knowledge-base/.config/prompts/`) need to know a behavioral change happened so they can inspect the bundled diff and decide whether to merge it into their override.

**How to apply:**

- A bug fix, a wording tightening, an added "what to skip" rule: bump the version.
- A reformatting that does not affect model behavior: no bump.
- Every prompt-version bump must be noted in the changelog so users can see it.
- The currently shipped versions are: `proposal-extract.md` v2, `curator.md` v3, `bootstrap-incremental.md` v2.
