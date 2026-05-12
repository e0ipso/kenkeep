---
schema_version: 1
id: map-session-log-and-queue-helpers
title: session-log and queue helpers in src/lib
kind: map
tags:
  - module
  - kb-pipeline
  - helpers
derived_from:
  - 20260512-1438-e5b4618a5295.md
relates_to:
  - map-kb-capture-hook
  - practice-one-session-log-per-session-id
depends_on: []
confidence: high
summary: >-
  `src/lib/session-log.ts` and `src/lib/queue.ts` expose lookup helpers used by
  capture to avoid duplicate session files and queue entries.
---
`src/lib/session-log.ts` exports `findSessionLogBySessionId(sessionsDir, sessionId)`, which scans `_sessions/` for any `*-${short}.md` and returns its filename if present.

`src/lib/queue.ts` exports `hasQueueEntry(file, sessionId)`, used by `src/lib/capture.ts` to decide whether to append a new queue entry. Together they implement the one-file-per-session_id invariant.
