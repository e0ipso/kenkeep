---
title: Settings
parent: Reference
nav_order: 4
---

# Settings

Settings are not yet exposed as a `.config.json` file (planned for M3). The defaults baked into the package are documented below for completeness.

## Stage-2 drain (M2)

These settings live in `src/lib/stage2-drain.ts` and `src/lib/headless.ts`. They are not currently user-configurable; the values are the result of "what makes sense for a small-to-medium KB and a single contributor."

| Setting | Default | Where applied | Behavior |
|---|---|---|---|
| `drainBound` | 5 entries | `drainStage2Queue` | Maximum number of queue entries processed per `SessionStart` invocation. Remaining entries are deferred to the next session. Keeps a long backlog from blocking a quick session start, even though the hook is async. |
| `maxAttempts` | 3 attempts | `drainStage2Queue` | A queue entry that fails (parse error, schema mismatch, timeout, non-zero exit) is rotated to the back of the queue with `attempts` incremented. After the third failure the session log is marked `stage_2_status: skipped` and the entry is removed from the queue. |
| `stage2Timeout` | 60,000 ms | `runHeadlessClaude` | Per-entry wall-clock deadline for the spawned `claude -p` subprocess. A timeout counts as a failed attempt for retry purposes. |
| `lockTtl` | 30 minutes | `acquireLock` | If a `state.json` lock is older than its TTL it is treated as stale and reclaimed. Prevents a crashed drain from blocking subsequent runs forever. |

## Stage-2 drain lock

`.ai/.kb-builder/state.json` carries `{ schema_version: 1, lock?: { name, pid, acquired_at, ttl_ms }, last_nudged_at? }`. The lock guards against two concurrent `SessionStart` events draining the same queue. Fields:

| Field | Purpose |
|---|---|
| `name` | Always `"stage2-drain"` for the drain. Curator (M3) will use its own name. |
| `pid` | The OS pid of the process holding the lock. Mostly informational; the lock is released by name+pid match. |
| `acquired_at` | ISO 8601 timestamp. Compared against `ttl_ms` to decide whether a lock is stale. |
| `ttl_ms` | Lock TTL in milliseconds. 1,800,000 (30 minutes) by default. |

## Stage-2 log files

Each drain invocation writes one stream-json file per processed entry under `.ai/knowledge-base/_logs/stage-2/`:

```
.ai/knowledge-base/_logs/stage-2/<session-id>__YYYYMMDDTHHMMSSZ.jsonl
```

The path is recorded in the session log's `stage_2_log` field. Logs are gitignored by default. See [Troubleshooting > Reading the stage-2 log](../troubleshooting/reading-stage-2-logs.md).

## Frontmatter changes on stage-2 completion

When the drain succeeds for an entry, the session log's frontmatter is updated in place:

```yaml
stage_2_status: done
stage_2_completed_at: 2026-05-11T10:00:00.000Z
stage_2_error: null
stage_2_log: _logs/stage-2/<session-id>__<timestamp>.jsonl
topics: [pii, gdpr, drupal, di]
proposals:
  practice: [...candidate objects...]
  map: [...candidate objects...]
```

On failure, only `stage_2_status` (`failed` or `skipped`), `stage_2_completed_at` (set only when `skipped`), `stage_2_error`, and `stage_2_log` are updated; `proposals` is left empty.

## Future settings (planned for M3)

`.ai/knowledge-base/.config.json` (committed) plus `~/.config/@e0ipso/ai-knowledge-base/config.json` (per-user override). Will surface: `drainBound`, `maxAttempts`, `stage2Timeout`, `lockTtl`, INDEX token budget, curation threshold, gitleaks ruleset path. Project settings win.
