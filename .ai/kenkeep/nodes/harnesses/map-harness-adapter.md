---
type: map
title: Harness adapter
description: >-
  Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and
  scripts. Five ship: claude, codex, cursor, opencode, copilot.
tags:
  - harness
  - adapter
  - claude
  - codex
  - cursor
  - opencode
  - copilot
  - architecture
kk_schema_version: 3
kk_id: map-harness-adapter
kk_derived_from:
  - README.md
  - docs/installation.md
  - docs/internals/architecture.md
  - CONTRIBUTING.md
kk_relates_to:
  - map-claude-harness
  - map-codex-harness
  - map-cursor-harness-adapter
  - map-opencode-harness
  - map-copilot-harness-adapter
  - practice-explicit-harness-flag-outside-claude
kk_depends_on: []
kk_confidence: high
---

# Harness adapter

A "harness" is one of the assistant CLIs the package drives. Five adapters ship: `claude` (Claude Code), `codex` (OpenAI Codex CLI), `cursor` (Cursor agent), `opencode` (OpenCode), and `copilot` (GitHub Copilot CLI). Each lives under `src/harnesses/<id>/` and implements the `HarnessAdapter` contract in `src/harnesses/types.ts`.

Each adapter declares the event names its host runtime actually emits (there is no global event enum). Claude uses `Stop`/`SessionEnd`/`PreCompact`/`SessionStart`; Codex reuses Claude's names but only emits `Stop` and `SessionStart`; Cursor uses native camelCase (`stop`, `sessionEnd`, `preCompact`, `sessionStart`); OpenCode uses `session.idle`/`session.created`; Copilot uses `sessionStart`/`sessionEnd`/`agentStop`. Adapters never reach into each other's directories; harness-neutral logic lives under `src/lib/` or `src/commands/`.

Active-harness resolution priority (in `src/harnesses/detect.ts`): explicit `--harness <id>` flag, then env detection (`CLAUDECODE=1` for Claude; `CURSOR_VERSION` for Cursor; Codex, OpenCode, and Copilot export no marker), then `cliDefaultHarness` in `config.yaml`, then the first registered harness. The same priority is mirrored inside skills via the materialized `/tmp/kk-detect-harness.mjs` helper (with an early `CLAUDECODE=1` return so Claude wins over Cursor when both env signals leak).

The central registry is `src/harnesses/registry.ts`. The `HarnessAdapter` interface provides `id`, `hooks`, `paths`, `install`, `upgrade`, `parseTranscript`, `renderTranscript`, `runHeadless`, `buildHarnessOpts`, `doctorChecks`, and optional `detectFromEnv`.

Each hook declaration is a `HookSpec`: `{ event, scriptPath, matcher?, async?, payload? }`. `payload?: Record<string, unknown>` is an opaque per-adapter blob consumed only by that adapter's hooks-config writer; shared code never reads it. Copilot uses it to carry the per-event `{ type, timeoutSec, env }` knobs its JSON hook format requires.

<!-- kk:related:start -->
# Related

- Related: [map-claude-harness](/harnesses/map-claude-harness.md)
- Related: [map-codex-harness](/harnesses/map-codex-harness.md)
- Related: [map-cursor-harness-adapter](/harnesses/map-cursor-harness-adapter.md)
- Related: [map-opencode-harness](/harnesses/map-opencode-harness.md)
- Related: [map-copilot-harness-adapter](/harnesses/map-copilot-harness-adapter.md)
- Related: [practice-explicit-harness-flag-outside-claude](/harnesses/practice-explicit-harness-flag-outside-claude.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
[2] [docs/installation.md](docs/installation.md)
[3] [docs/internals/architecture.md](docs/internals/architecture.md)
[4] [CONTRIBUTING.md](CONTRIBUTING.md)
<!-- kk:citations:end -->
