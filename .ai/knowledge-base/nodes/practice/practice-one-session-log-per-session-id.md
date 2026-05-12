---
schema_version: 1
id: practice-one-session-log-per-session-id
title: 'One session log per session_id, not per assistant turn'
kind: practice
tags:
  - kb-capture
  - session-log
  - hooks
  - dedup
derived_from:
  - 20260512-1438-e5b4618a5295.md
relates_to:
  - map-kb-capture-hook
  - map-dedup-cache
  - map-session-log-and-queue-helpers
depends_on: []
confidence: high
summary: >-
  kb-capture must overwrite the existing session log for a session_id rather
  than create a new file on every Stop hook.
---
The Claude Code Stop hook fires at the end of every assistant turn. If `kb-capture` writes a new `_sessions/*.md` file each time, a single conversation produces N nested-superset files (each later capture's transcript contains the previous one verbatim plus the latest turn), and the extraction step burns an LLM call per file on overlapping content.

The sha256-of-slice dedup cache cannot catch this because the hash changes every turn; it only protects against the exact same transcript being captured twice (e.g. Stop+SessionEnd back-to-back with no new content).

Correct behavior: before writing, look up an existing `*-${short}.md` for this `session_id` and reuse that filename (overwrite in place). Only append a queue entry when no pending entry already points at the session. If the existing entry's status is already `done`, re-queue it so extraction can re-run on the longer transcript.
