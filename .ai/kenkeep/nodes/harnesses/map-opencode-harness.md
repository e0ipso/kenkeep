---
schema_version: 2
id: map-opencode-harness
title: OpenCode harness adapter
kind: map
tags:
  - harness
  - opencode
  - hooks
  - plugin
derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - README.md
relates_to:
  - map-harness-adapter
depends_on: []
confidence: high
summary: >-
  OpenCode adapter; single TS plugin shim subscribes to event bus and dispatches
  session.idle/session.created to per-event Node scripts under
  .opencode/kk-hooks/.
---

# OpenCode harness adapter

OpenCode's idiomatic event surface is a long-lived plugin module subscribed to the runtime event bus, not per-event shell commands. The adapter ships a single TS plugin shim at `.opencode/plugins/kb.mjs` that subscribes to the event bus and dispatches `session.idle` and `session.created` to per-event Node scripts under `.opencode/kk-hooks/`.

Installed paths:

- `.opencode/plugins/kb.mjs` — TS plugin shim. Self-registering by virtue of its location; OpenCode auto-loads every plugin under `.opencode/plugins/` at startup.
- `.opencode/kk-hooks/` — per-event scripts (`kk-capture.mjs`, `kk-session-start.mjs`, `kk-proposal-drain.mjs`, `kk-lint-tick.mjs`). The directory is `kk-hooks/` rather than `hooks/` to avoid collision with the runtime-reserved `.opencode/hooks/`.
- `.opencode/skills/` — the shared `kk-add`, `kk-bootstrap`, `kk-curate` skills.

OpenCode's hook payload does not carry a `transcript_path`. The capture script parses on-disk session storage under `${XDG_DATA_HOME:-$HOME/.local/share}/opencode/storage/`: `session/<projectID>/<sessionID>.json`, then `message/<sessionID>/*.json` ordered by `time.created`, concatenating text parts under `part/<messageID>/`. If the on-disk parse yields zero turns, the hook falls back to spawning `opencode export <sessionID>` (30-second timeout) and adapting its JSON output.

OpenCode also has no v1 equivalent of Claude's `SessionStart` `additionalContext` stdout channel, so the session-start hook writes the current ENTRY body to `.opencode/AGENTS.md`; users opt in by referencing that file from their primary `AGENTS.md`.

OpenCode exports no in-session env var; pass `--harness opencode` or set `cliDefaultHarness: opencode`.
