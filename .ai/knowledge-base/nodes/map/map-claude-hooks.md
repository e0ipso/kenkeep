---
schema_version: 1
id: map-claude-hooks
title: "Claude Code hooks registered by ai-knowledge-base"
kind: map
tags: [hooks, claude-code, integration]
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to: []
confidence: high
summary: "Three hook scripts under .claude/hooks/: kb-capture, kb-proposal-drain, kb-session-start."
---

# Claude Code hooks registered by ai-knowledge-base

`init` writes three hook scripts under `.claude/hooks/` and registers them in `.claude/settings.json`:

| Script | Event(s) | Mode | Role |
|---|---|---|---|
| `kb-capture.mjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s | Redact transcript with secretlint and write a session log. |
| `kb-proposal-drain.mjs` | `SessionStart` | async | Sweep pending session logs, spawn `claude -p` to extract proposal candidates. |
| `kb-session-start.mjs` | `SessionStart` | sync, ≤1s | Inject `INDEX.md` (plus optional staleness/nudge lines) into the new session. |

The two `SessionStart` entries are independent; failure in one does not block the other. The KB hook scripts are *consumers* of Claude Code's hook mechanism, not extension points: `ai-knowledge-base` does not expose a hook API of its own.

User-defined hooks in `.claude/settings.json` are preserved on re-init.

The Codex and OpenCode adapters wire equivalent functions through their own native event surfaces; see [[map-codex-harness-adapter]] and [[map-opencode-harness-adapter]].
