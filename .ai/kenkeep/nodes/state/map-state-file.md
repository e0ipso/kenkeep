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
  - map-proposal-drain-hook
depends_on: []
confidence: high
summary: >-
  Gitignored runtime state. Carries only last_nudged_at; the proposal-drain lock
  is a sidecar proper-lockfile directory (60s stale, auto-reclaimed), not a JSON
  field.
---

# `.state/state.json`

Gitignored runtime state, validated by `StateFileSchema`.

```json
{
  "schema_version": 1,
  "last_nudged_at": "2026-05-11T10:00:00Z"
}
```

The file carries only `last_nudged_at`. There is **no `lock` field** in the JSON — the proposal-drain lock is a sidecar `proper-lockfile` directory (`state.json.lock`), not a field in this file.

`last_nudged_at` is written by `kk-session-start` after it appends the curate nudge to the session's `additionalContext`. Recorded for audit purposes; no throttle is applied.

## The proposal-drain lock

Only the **proposal-drain hook** locks `state.json`. It uses `proper-lockfile` (a `mkdir`-atomic `state.json.lock` directory whose mtime is refreshed on a heartbeat while held; `PROPOSAL_DRAIN_LOCK_OPTIONS.stale` = 60s). A drain SIGKILLed by the host's outer hook timeout can neither run its `finally` release nor `proper-lockfile`'s graceful-exit handler, so the lock only clears once it goes stale; the next drain auto-reclaims it on acquire (recovery within ~60s). `DrainSummary.recoveredStaleLock` flags a reclaimed stale lock; the ELOCKED path reports lock age + ETA.

**Curate, bootstrap, and consume do not lock `state.json`.** Curate and bootstrap each run in a single host harness session per invocation (single-author by design); the atomic tmp+rename writes inside `node write` and `curate-dedup` provide durability. `node write` does take a `proper-lockfile` lock, but on the separate `bootstrap-state.json` (with retries, to serialise concurrent `--source-doc` writers); `reconcileUsage` locks `usage.jsonl`. Neither touches `state.json`.

Manual recovery (rare): remove the `.ai/kenkeep/.state/state.json.lock` directory if a stale lock somehow persists past the 60s window.
