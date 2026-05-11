---
title: Settings
parent: Reference
nav_order: 4
---

# Settings

Two layers, both optional:

1. **Project**: `.ai/knowledge-base/.config.json` (committed; created by `init`).
2. **User**: `~/.config/@e0ipso/ai-knowledge-base/config.json` (or `$XDG_CONFIG_HOME/...`; not committed).

Resolution: `package defaults ← user file ← project file`. Project wins.

## File

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

Strict Zod parse. Unknown keys cause `doctor` to fail. Every key except `schema_version` is optional. A malformed user file emits a warning and is ignored; a malformed project file is a hard error.

## Keys

| Key | Type | Default | Behavior |
|---|---|---|---|
| `drainBound` | int > 0 | `5` | Max stage-2 entries drained per `SessionStart`. |
| `maxAttempts` | int > 0 | `3` | Retries before marking a log `skipped`. |
| `stage2Timeout` | int ms | `60000` | Per-entry subprocess deadline. |
| `lockTtlMs` | int ms | `1800000` | Lock TTL for stage-2 drain, curator, bootstrap. |
| `indexBudgetTokens` | int > 0 | `2000` | INDEX.md token budget (~4 chars/token). |
| `curationThreshold` | int > 0 | `5` | Pending logs that trigger the nudge. Throttled hourly. |
| `bootstrapTokenBudget` | int > 0 | `10000` | Per-batch budget for `bootstrap-incremental`. |
| `gitleaksRulesPath` | string \| null | `null` | Reserved for a future override. Not yet honored. |
| `logsRetentionDays` | int > 0 | `30` | Default `--older-than` for `logs prune`. |

CLI flags (`--batch-size`, `--token-budget`, `--timeout`, `--budget-tokens`, `--older-than`) override settings per run.

## Lock state

`.ai/knowledge-base/.state/state.json`:

```json
{
  "schema_version": 1,
  "lock": {
    "name": "stage2-drain | curator | bootstrap-incremental",
    "pid": 12345,
    "acquired_at": "2026-05-11T10:00:00Z",
    "ttl_ms": 1800000
  },
  "last_nudged_at": "2026-05-11T10:00:00Z"
}
```

`lock` is `null` when no lock is held. Stale locks (past TTL) are reclaimed.
