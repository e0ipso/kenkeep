---
schema_version: 1
id: map-kb-capture-hook
title: 'kb-capture hook: writes session logs on Stop/SessionEnd/PreCompact'
kind: map
tags:
  - hook
  - capture
  - kb-pipeline
derived_from:
  - 20260512-1438-e5b4618a5295.md
relates_to:
  - map-claude-hooks
depends_on: []
confidence: high
summary: >-
  Hook that reads the full transcript JSONL, validates the session_id, runs
  secretlint, and writes a session log keyed by session_id.
---
`templates/claude/hooks/kb-capture.mjs` (built from `src/hooks/kb-capture.ts` and `src/lib/capture.ts`) runs on `Stop`, `SessionEnd`, and `PreCompact` events. On each invocation it validates `session_id` against the UUID v4 shape via `assertValidSessionId`, reads the entire `transcript_path` JSONL, renders the role-tagged transcript, runs secretlint, and writes a `_sessions/*.md` file with `proposal_status: pending`.

The session-log filename pattern is `YYYYMMDD-HHmm-<sessionId>.md` (the full validated UUID, with dashes). A re-fire for the same `session_id` (multi-turn sessions, or PreCompact immediately after Stop) reuses the existing file via `findSessionLogBySessionId`, so the on-disk count stays at one log per session.
