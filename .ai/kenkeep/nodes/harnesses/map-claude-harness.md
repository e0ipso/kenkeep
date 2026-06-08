---
schema_version: 2
id: map-claude-harness
title: Claude Code harness adapter
kind: map
tags:
  - harness
  - claude
  - hooks
derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - docs/internals/hooks.md
relates_to:
  - map-harness-adapter
  - map-capture-hook
  - map-proposal-drain-hook
  - map-session-start-hook
depends_on: []
confidence: high
summary: >-
  Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in
  .claude/settings.json, installs skills at .claude/skills/.
---

# Claude Code harness adapter

The Claude adapter wires capture on three lifecycle events: `Stop`, `SessionEnd`, and `PreCompact`. Hook registration lives in `.claude/settings.json` under one block per event; user-defined hooks in the same file are preserved on re-init.

Installed paths:

- `.claude/hooks/` — the per-event Node scripts (`kk-capture.mjs`, `kk-proposal-drain.mjs`, `kk-session-start.mjs`).
- `.claude/skills/` — the `kk-add`, `kk-bootstrap`, and `kk-curate` skill bodies (same SKILL.md bytes as the Codex and OpenCode installs).

Claude is the only harness that exports an in-session env marker (`CLAUDECODE=1`), so the detector picks it automatically when running inside a Claude session. Outside that context, the `--harness claude` flag or `cliDefaultHarness: claude` in `config.yaml` is required.

Install command: `npx kenkeep init --harnesses claude`. Doctor checks Node version, `claude` on PATH, hook registration in `.claude/settings.json`, installed-version marker, and ENTRY freshness.
