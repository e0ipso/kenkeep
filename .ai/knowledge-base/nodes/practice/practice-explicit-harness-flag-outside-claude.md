---
schema_version: 1
id: practice-explicit-harness-flag-outside-claude
title: "Pass --harness explicitly outside an active Claude session"
kind: practice
tags: [harness, cli, codex, opencode]
derived_from:
  - docs/cli-reference.md
  - docs/installation.md
relates_to:
  - map-harness-adapter
  - map-config-yaml
depends_on: []
confidence: high
summary: "Only Claude exports an in-session env marker. From a Codex/OpenCode session or a plain shell, pass --harness explicitly or set cliDefaultHarness."
---

# Pass `--harness` explicitly outside an active Claude session

The `--harness <id>` flag (one of `claude`, `codex`, `opencode`) selects which adapter drives the CLI invocation. Inside an active Claude Code session the detector picks Claude automatically via `CLAUDECODE=1`. **Codex and OpenCode export no in-session env var.**

**Why:** the CLI cannot tell which adapter you mean. Falling back to the first registered harness yields silently-wrong results — a `doctor` run checking the wrong runtime, a `curate` writing to the wrong skills dir. Failing-explicit is preferred to silently-wrong.

**How to apply:**

- From a plain shell, or from inside a Codex/OpenCode session, pass `--harness <id>` to every invocation: `npx @e0ipso/ai-knowledge-base --harness codex doctor`.
- Or set `cliDefaultHarness: <id>` in `.ai/knowledge-base/config.yaml` so plain-shell invocations default to your harness. Skills and hooks ignore this setting and always resolve via env detection or explicit `--harness`.
- Skills materialize a `/tmp/kb-detect-harness.mjs` helper that mirrors the same priority (explicit `--hint`, env detection, `cliDefaultHarness`); a CI lint (`npm run lint:detect-harness`) catches drift between the helper and `src/harnesses/detect.ts`.
