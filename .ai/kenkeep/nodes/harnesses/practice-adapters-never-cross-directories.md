---
schema_version: 2
id: practice-adapters-never-cross-directories
title: Adapters never reach into each other's directories
kind: practice
tags:
  - adapter
  - architecture
  - isolation
derived_from:
  - CONTRIBUTING.md
  - docs/internals/architecture.md
relates_to:
  - map-harness-adapter
  - practice-no-event-translation-across-adapters
depends_on: []
confidence: high
summary: >-
  Anything shared lives under src/lib, src/commands, or
  src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/.
---

# Adapters never reach into each other's directories

Per-adapter code lives strictly under `src/harnesses/<id>/`. Anything shared — paths under `.ai/kenkeep/`, the curator pipeline, the node schema, the secret scanner, the shared SKILL.md tree — lives in the harness-neutral modules under `src/lib/` or `src/commands/`, or under `src/templates-source/skills/`.

**Why:** every adapter must compile, lint, and pass tests independently. Letting the Claude adapter import from `src/harnesses/codex/` (or vice versa) couples release schedules and produces weird breakages when a future adapter is added. Three adapters ship today (claude, codex, opencode); a fourth should slot in without touching any of the existing three.

**How to apply:**

- New cross-cutting logic? Find or create a home under `src/lib/` or `src/commands/`.
- New shared skill content? Put it under `src/templates-source/skills/`. All three harnesses install identical SKILL.md bytes from this tree.
- New per-adapter behavior? Stays under `src/harnesses/<id>/`. The `HarnessAdapter` interface in `src/harnesses/types.ts` is the only contract the rest of the system relies on.
- Tests for an adapter go under `tests/harnesses/<id>/`.
