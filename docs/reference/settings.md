---
title: Settings
parent: Reference
nav_order: 4
---

# Settings

`ai-knowledge-base` reads its tunable knobs from a two-layer settings file:

1. **Project-level**: `.ai/knowledge-base/.config.json` (committed to the repo). Created by `init` populated with the package defaults.
2. **User-level**: `~/.config/@e0ipso/ai-knowledge-base/config.json` (or `$XDG_CONFIG_HOME/@e0ipso/ai-knowledge-base/config.json` if set). Not committed.

Both files are optional. Resolution order (later wins):

```
package defaults  ←  user file  ←  project file
```

This means the repo's own `.config.json` is always authoritative. The user file lets a contributor reduce e.g. `stage2Timeout` for a slow box without touching the project's checked-in config.

## File shape

```json
{
  "schema_version": 1,
  "drainBound": 5,
  "maxAttempts": 3,
  "stage2Timeout": 60000,
  "lockTtlMs": 1800000,
  "indexBudgetTokens": 2000,
  "curationThreshold": 5,
  "bootstrapTokenBudget": 10000,
  "gitleaksRulesPath": null,
  "logsRetentionDays": 30
}
```

The Zod schema is strict: unknown keys cause `doctor` to fail with a validation error. Every key except `schema_version` is optional; omitted keys fall through to the next layer.

A malformed user file is not fatal — `resolveSettings()` emits a warning to the calling command and treats the file as absent so a corrupted user override cannot brick the CLI.

## Keys

| Key | Type | Default | Behavior |
|---|---|---|---|
| `drainBound` | int > 0 | `5` | Maximum number of stage-2 queue entries the async drain processes per `SessionStart`. Remaining entries are deferred to the next session. Keeps a long backlog from blocking a quick session start. |
| `maxAttempts` | int > 0 | `3` | A failed stage-2 entry (parse error, schema mismatch, timeout, non-zero exit) is rotated to the back of the queue with `attempts` incremented. After this many failures the session log is marked `stage_2_status: skipped` and the entry is removed. |
| `stage2Timeout` | int > 0 (ms) | `60000` | Per-entry wall-clock deadline for the spawned `claude -p` stage-2 subprocess. A timeout counts as a failed attempt for retry purposes. |
| `lockTtlMs` | int > 0 (ms) | `1800000` (30 min) | TTL for the `.ai/knowledge-base/.state/state.json` lock. A lock older than its TTL is treated as stale and reclaimed, preventing a crashed run from blocking subsequent invocations. Applies to the stage-2 drain, curator, and bootstrap-incremental locks. |
| `indexBudgetTokens` | int > 0 | `2000` | INDEX.md token budget (~4 chars/token). Per-kind sections trim oldest entries until the rendered body fits; trimmed counts go into a "_N additional nodes hidden by token budget_" footer. |
| `curationThreshold` | int > 0 | `5` | Number of pending session logs that triggers the curate-nudge on the next `SessionStart`. The nudge is throttled to at most once per hour. |
| `bootstrapTokenBudget` | int > 0 | `10000` | Approximate per-batch token budget for `ai-knowledge-base bootstrap-incremental`. Docs are atomic — a single oversized doc lands in its own batch. |
| `gitleaksRulesPath` | string or null | `null` | Reserved for a future capture-time gitleaks rule override. Not yet honored by the capture hook; v1.5 ships the setting so users can write the path now without a future schema bump. |
| `logsRetentionDays` | int > 0 | `30` | Default `--older-than` window for `ai-knowledge-base logs prune`. The CLI flag still wins when given. |

## CLI flags vs. settings

Per-command flags (`--batch-size`, `--token-budget`, `--timeout`, `--budget-tokens`) always override the settings value for that run. Use flags for one-off experiments, the settings file for the steady state.

## Lock state

`.ai/knowledge-base/.state/state.json` carries `{ schema_version: 1, lock?: { name, pid, acquired_at, ttl_ms }, last_nudged_at? }`. The lock guards against concurrent stage-2 drains, curate runs, and bootstrap-incremental runs. Field reference:

| Field | Purpose |
|---|---|
| `name` | `"stage2-drain"`, `"curator"`, or `"bootstrap-incremental"`. |
| `pid` | OS pid of the process holding the lock. Mostly informational; the lock is released by name+pid match. |
| `acquired_at` | ISO 8601 timestamp. Compared against `ttl_ms` to decide whether a lock is stale. |
| `ttl_ms` | Lock TTL in milliseconds. Sourced from `lockTtlMs` above. |

## Doctor

`ai-knowledge-base doctor` runs a `settings file is valid` check. If `.config.json` is missing the check is a warning (defaults are in effect); if it is unparseable or fails Zod validation the check is an error and `doctor` exits 1.

## Stage-2 log files

Each drain invocation writes one stream-json file per processed entry under `.ai/knowledge-base/_logs/stage-2/`:

```
.ai/knowledge-base/_logs/stage-2/<session-id>__YYYYMMDDTHHMMSSZ.jsonl
```

The path is recorded in the session log's `stage_2_log` field. Logs are gitignored by default. See [Troubleshooting > Reading the stage-2 log](../troubleshooting/reading-stage-2-logs.md). Use `ai-knowledge-base logs prune` to bound their growth.

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
