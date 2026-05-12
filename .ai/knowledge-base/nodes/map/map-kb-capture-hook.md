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
  - map-dedup-cache
  - map-session-log-and-queue-helpers
depends_on: []
confidence: high
summary: >-
  Hook that reads the full transcript JSONL, hashes it, dedup-checks, and writes
  a session log plus a queue entry.
---
`templates/claude/hooks/kb-capture.mjs` (built from `src/lib/capture.ts`) runs on `Stop`, `SessionEnd`, and `PreCompact` events. On each invocation it reads the entire `transcript_path` JSONL, renders the role-tagged transcript, hashes it, checks the dedup cache, then writes a `_sessions/*.md` file and appends an entry to `.queue.json`.

The session-log filename pattern is `<timestamp>-<short-session-id>.md`. Lookup of an existing file for a session reuses the `-${short}.md` suffix.
