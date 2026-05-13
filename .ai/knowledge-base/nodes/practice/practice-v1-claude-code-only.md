---
schema_version: 1
id: practice-v1-claude-code-only
title: "v1 supports Claude Code only"
kind: practice
tags: [scope, claude-code, v1]
derived_from:
  - PRD.md
  - docs/internals/architecture.md
relates_to: []
confidence: high
summary: "v1 supports Claude Code as the sole assistant. Assistant-specific code lives in dedicated helpers (writeClaudeHookConfig, runHeadlessClaude); no plurality is implied."
---

# v1 supports Claude Code only

`SUPPORTED_ASSISTANTS` is hardcoded to `['claude']`. The package ships exactly one assistant integration.

Assistant-specific code is reachable directly:

- Hook installation in `.claude/settings.json` goes through `writeClaudeHookConfig` in `src/lib/hooks-config.ts`.
- Subprocess invocation goes through `runHeadlessClaude` in `src/lib/headless.ts`.

There is no abstraction layer prepared for additional assistants. Adding another assistant in the future means writing new helpers and call sites, not implementing an interface.
