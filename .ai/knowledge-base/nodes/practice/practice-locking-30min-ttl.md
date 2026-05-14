---
schema_version: 1
id: practice-locking-30min-ttl
title: "Per-pipeline locks in state.json with 30-minute TTL"
kind: practice
tags: [locking, state, concurrency]
derived_from:
  - docs/internals/architecture.md
  - docs/troubleshooting.md
relates_to: []
confidence: high
summary: "One lock at a time in .state/state.json (name, pid, acquired_at, ttl_ms). Stale locks reclaimed after 30 min. Consume doesn't lock."
---

# Per-pipeline locks in `state.json` with 30-minute TTL

Pipelines that race on the same queue acquire a named lock in `.ai/knowledge-base/.state/state.json`:

- `proposal-drain` - prevents concurrent `SessionStart` drains.
- `curator` - prevents duplicate proposals from concurrent `curate` runs.
- `bootstrap-incremental` - same for bootstrap.

The lock holds `{ name, pid, acquired_at, ttl_ms }`. TTL is 30 minutes (configurable via the `lock` TTL setting). Stale locks past TTL are reclaimed automatically. **Consume does not lock.**

Cross-pipeline: `curate` and `bootstrap-incremental` do **not** block each other (distinct lock names).

**How to apply:**

- A new pipeline that writes to `nodes/` or `_sessions/` queue should acquire its own lock via the shared helper; do not invent ad-hoc locking schemes.
- When a user reports a "locked by …" error and the prior run is genuinely gone, point them at the stale-lock recovery: wait the TTL, or hand-clear the `lock` field in `state.json`.
- Tests for new pipelines should include a concurrent-lock case and a stale-lock-reclaim case (mirrors the manual test plan).
