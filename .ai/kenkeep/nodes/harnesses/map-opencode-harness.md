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

OpenCode's hook payload does not carry a `transcript_path`. The capture script sources both the transcript and the read-usage paths from `opencode export <sessionID>` (30-second timeout) — its sole, primary source; there is no on-disk file-tree parser or fallback. It parses the export JSON once (`{ info, messages: [{ info: { role, time }, parts: [...] }] }`): transcript text comes from `type === 'text'` parts and read usage from `type === 'tool' && tool === 'read'` parts via `state.input.filePath`. The incoming session id is `ses_<base62>` (not a UUID), so the hook normalizes it to a deterministic UUID v4 via `normalizeOpenCodeSessionId` before `assertValidSessionId`.

OpenCode also has no v1 equivalent of Claude's `SessionStart` `additionalContext` stdout channel, so the session-start hook writes the current ENTRY body to `.opencode/AGENTS.md`; users opt in by referencing that file from their primary `AGENTS.md`.

OpenCode exports no in-session env var; pass `--harness opencode` or set `cliDefaultHarness: opencode`.
