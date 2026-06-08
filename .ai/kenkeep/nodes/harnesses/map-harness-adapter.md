---
schema_version: 2
id: map-harness-adapter
title: Harness adapter
kind: map
tags:
  - harness
  - adapter
  - claude
  - codex
  - cursor
  - opencode
  - copilot
  - architecture
derived_from:
  - README.md
  - docs/installation.md
  - docs/internals/architecture.md
  - CONTRIBUTING.md
relates_to:
  - map-claude-harness
  - map-codex-harness
  - map-cursor-harness-adapter
  - map-opencode-harness
  - map-copilot-harness-adapter
  - practice-explicit-harness-flag-outside-claude
depends_on: []
confidence: high
summary: >-
  Per-runtime adapter implementing HarnessAdapter; declares its event
  vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex,
  cursor, opencode, copilot.
---

# Harness adapter

A "harness" is one of the assistant CLIs the package drives. Five adapters ship: `claude` (Claude Code), `codex` (OpenAI Codex CLI), `cursor` (Cursor agent), `opencode` (OpenCode), and `copilot` (GitHub Copilot CLI). Each lives under `src/harnesses/<id>/` and implements the `HarnessAdapter` contract in `src/harnesses/types.ts`.

Each adapter declares the event names its host runtime actually emits (there is no global event enum). Claude uses `Stop`/`SessionEnd`/`PreCompact`/`SessionStart`; Codex reuses Claude's names but only emits `Stop` and `SessionStart`; Cursor uses native camelCase (`stop`, `sessionEnd`, `preCompact`, `sessionStart`); OpenCode uses `session.idle`/`session.created`; Copilot uses `sessionStart`/`sessionEnd`/`agentStop`. Adapters never reach into each other's directories; harness-neutral logic lives under `src/lib/` or `src/commands/`.

Active-harness resolution priority (in `src/harnesses/detect.ts`): explicit `--harness <id>` flag, then env detection (`CLAUDECODE=1` for Claude; `CURSOR_VERSION` for Cursor; Codex, OpenCode, and Copilot export no marker), then `cliDefaultHarness` in `config.yaml`, then the first registered harness. The same priority is mirrored inside skills via the materialized `/tmp/kk-detect-harness.mjs` helper (with an early `CLAUDECODE=1` return so Claude wins over Cursor when both env signals leak).

The central registry is `src/harnesses/registry.ts`. The `HarnessAdapter` interface provides `id`, `hooks`, `paths`, `install`, `upgrade`, `parseTranscript`, `renderTranscript`, `runHeadless`, `buildHarnessOpts`, `doctorChecks`, and optional `detectFromEnv`.

Each hook declaration is a `HookSpec`: `{ event, scriptPath, matcher?, async?, payload? }`. `payload?: Record<string, unknown>` is an opaque per-adapter blob consumed only by that adapter's hooks-config writer; shared code never reads it. Copilot uses it to carry the per-event `{ type, timeoutSec, env }` knobs its JSON hook format requires.
