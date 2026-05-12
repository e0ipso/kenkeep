---
schema_version: 1
id: map-claude-hooks
title: "The three Claude Code hooks registered by init"
kind: map
tags: [hooks, claude-code, capture, extract, consume]
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to: [practice-hooks-meet-1s-deadline, practice-recursion-guard-env-var]
depends_on: []
confidence: high
summary: "init registers three hook scripts in .claude/settings.json: kb-capture (Stop/SessionEnd/PreCompact), kb-proposal-drain (SessionStart async), kb-session-start (SessionStart sync)."
---

# The three Claude Code hooks registered by init

`init` registers three hook scripts in `.claude/settings.json`, compiled to `.claude/hooks/*.mjs` from the TS sources under `src/hooks/`.

| Script | Events | Mode |
|---|---|---|
| `kb-capture.mjs` | `Stop`, `SessionEnd`, `PreCompact` | sync, ≤1s |
| `kb-proposal-drain.mjs` | `SessionStart` | async (`async: true`) |
| `kb-session-start.mjs` | `SessionStart` | sync, ≤1s |

The two `SessionStart` entries are independent; a failure in one does not block the other.

- **Capture** reads the transcript, dedupes against a 5-minute SHA-256 window, runs secretlint with the recommended preset, and writes `_sessions/<ts>-<id>.md`. The `KB_BUILDER_HOOK=<event>` env var distinguishes Stop / SessionEnd / PreCompact triggers.
- **Drain** is async: it spawns `claude -p` per pending session log (up to `drainBound`, default 5), streams `_logs/proposal/*.jsonl`, and updates the log to `proposal_status: done` or rotates with `attempts++` on failure.
- **Consume** loads `INDEX.md`, checks `nodes_hash` for drift, emits a curate nudge if pending logs exceed `curationThreshold` (default 5) and last nudge was over an hour ago.
