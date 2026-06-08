---
schema_version: 2
id: practice-explicit-harness-flag-outside-claude
title: Pass --harness explicitly outside an active harness session
kind: practice
tags:
  - harness
  - cli
  - codex
  - cursor
  - opencode
derived_from:
  - docs/cli-reference.md
  - docs/installation.md
relates_to:
  - map-harness-adapter
  - map-cursor-harness-adapter
  - map-config-yaml
depends_on: []
confidence: high
summary: >-
  Claude and Cursor export in-session env markers; Codex and OpenCode do not.
  From those sessions or a plain shell, pass --harness explicitly or set
  cliDefaultHarness.
---

# Pass `--harness` explicitly outside an active harness session

The `--harness <id>` flag (one of `claude`, `codex`, `cursor`, `opencode`) selects which adapter drives the CLI invocation. Inside an active Claude Code session the detector picks Claude via `CLAUDECODE=1`. Inside Cursor, `CURSOR_VERSION` resolves to `cursor` unless `CLAUDECODE=1` is also set (Claude wins). **Codex and OpenCode export no in-session env var.**

**Why:** the CLI cannot tell which adapter you mean. Falling back to the first registered harness yields silently-wrong results — a `doctor` run checking the wrong runtime, a `curate` writing to the wrong skills dir. Failing-explicit is preferred to silently-wrong.

**How to apply:**

- From a plain shell, or from inside a Codex/OpenCode session, pass `--harness <id>` to every invocation: `npx kenkeep --harness codex doctor`.
- Or set `cliDefaultHarness: <id>` in `.ai/kenkeep/config.yaml` so plain-shell invocations default to your harness. Skills and hooks ignore this setting and always resolve via env detection or explicit `--harness`.
- Skills materialize a `/tmp/kk-detect-harness.mjs` helper that mirrors the same priority (explicit `--hint`, env detection, `cliDefaultHarness`); a CI lint (`npm run lint:detect-harness`) catches drift between the helper and `src/harnesses/detect.ts`.
