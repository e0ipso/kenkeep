---
schema_version: 2
id: map-state-file
title: .state/state.json (lock + nudge state)
kind: map
tags:
  - state
  - lock
  - schema
derived_from:
  - docs/internals/architecture.md
  - docs/internals/schemas.md
relates_to:
  - map-bootstrap-state-file
depends_on: []
confidence: high
summary: >-
  Gitignored runtime state. Holds one lock at a time (30-min TTL, stale locks
  reclaimed) and last_nudged_at.
---

# `.state/state.json`

Gitignored runtime state, validated by `StateFileSchema`.

```json
{
  "schema_version": 1,
  "lock": { "name": "...", "pid": 12345, "acquired_at": "...", "ttl_ms": 1800000 },
  "last_nudged_at": "2026-05-11T10:00:00Z"
}
```

`lock` is `null` when no lock is held. Three named locks (one at a time):

- `proposal-drain` — prevents concurrent `SessionStart` drains racing on the queue.
- `curator` — prevents duplicate proposals from concurrent `curate` runs.
- `bootstrap-incremental` — same, for the bootstrap CLI.

`curate` and `bootstrap-incremental` use **distinct** lock names, so they do not block each other.

TTL is 30 minutes; stale locks are reclaimed. Manual recovery: clear the `lock` field manually if a process died without releasing.

`last_nudged_at` is written by `kk-session-start.mjs` after it appends the curate nudge to the session's `additionalContext`. Recorded for audit purposes; no throttle is applied.
