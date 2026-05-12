---
schema_version: 1
id: map-state-json-file
title: ".state/state.json: lock and nudge timestamp"
kind: map
tags: [state, lock, nudge, gitignore]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/internals/schemas.md
  - docs/internals/architecture.md
relates_to: [map-claude-hooks]
depends_on: []
confidence: high
summary: "Holds the single-lock-at-a-time pipeline lock (30-min TTL) and last_nudged_at. Gitignored. Stale locks are reclaimed."
---

# `.state/state.json`: lock and nudge timestamp

Shape (validated by `StateFileSchema`):

```json
{
  "schema_version": 1,
  "lock": { "name": "...", "pid": 12345, "acquired_at": "...", "ttl_ms": 1800000 },
  "last_nudged_at": "<ISO>"
}
```

Holds one lock at a time. Default TTL is 30 minutes (`DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000` in `src/lib/state.ts`); stale locks past their TTL are reclaimed by the next acquirer.

Three lock names are used:

- `stage2-drain`: prevents concurrent SessionStart drains racing on the queue.
- `curator`: prevents duplicate proposals from concurrent `curate` runs.
- `bootstrap-incremental`: same, for bootstrap.

Different names do not block each other; `curate` and `bootstrap-incremental` can run concurrently. The consume hook (`kb-session-start.mjs`) does not lock.

`last_nudged_at` throttles the curate nudge to at most once per hour. Gitignored.
