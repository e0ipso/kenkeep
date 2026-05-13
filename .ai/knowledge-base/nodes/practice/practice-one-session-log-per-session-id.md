---
schema_version: 1
id: practice-one-session-log-per-session-id
title: 'One session log per session_id, not per assistant turn'
kind: practice
tags:
  - kb-capture
  - session-log
  - hooks
derived_from:
  - 20260512-1438-e5b4618a5295.md
relates_to:
  - map-kb-capture-hook
depends_on: []
confidence: high
summary: >-
  kb-capture must overwrite the existing session log for a session_id rather
  than create a new file on every Stop hook.
---
The Claude Code Stop hook fires at the end of every assistant turn. If `kb-capture` writes a new `_sessions/*.md` file each time, a single conversation produces N nested-superset files (each later capture's transcript contains the previous one verbatim plus the latest turn), and the extraction step burns an LLM call per file on overlapping content.

Correct behavior: validate `session_id` once at the hook boundary, then look up an existing `*-<sessionId>.md` for this session via `findSessionLogBySessionId` and reuse that filename (overwrite in place). The session-id-based overwrite is the only mechanism: every Stop re-runs the secret scan and re-renders the file, but the on-disk count stays at one per session.
