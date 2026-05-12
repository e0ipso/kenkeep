---
schema_version: 1
id: practice-v1-claude-code-only
title: "v1 ships Claude Code only; the adapter interface is preparation, not plurality"
kind: practice
tags: [adapters, scope, claude-code, v1]
derived_from:
  - PRD.md
  - docs/internals/architecture.md
relates_to: [map-adapter-interface]
depends_on: []
confidence: high
summary: "v1 supports Claude Code as the sole assistant. The adapter interface isolates assistant-specific code so v2 can add others; v1 does not."
---

# v1 ships Claude Code only; the adapter interface is preparation, not plurality

v1 supports Claude Code as the sole assistant. The architecture isolates assistant-specific code behind the `Adapter` interface in `src/adapters/types.ts` so adapters for other AI assistants can be added later, but only `adapters/claude.ts` ships in v1.

When working on the package, treat the adapter interface as the seam, not as evidence of pluralism: every code path that talks to an assistant must go through an `Adapter` method, but you only need to make Claude Code work.

Adapters for other assistants are an explicit v2 goal, not an open question.
