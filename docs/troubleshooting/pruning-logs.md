---
title: Pruning logs
parent: Troubleshooting
nav_order: 4
---

# Pruning logs

`.ai/knowledge-base/_logs/` accumulates a stream-json trace per stage-2 entry, curate run, and bootstrap-incremental run. Gitignored, but unbounded. `ai-knowledge-base logs prune` is the housekeeping tool.

## When to prune

- `du -sh _logs/` is in the hundreds of megabytes.
- You're packaging the repo.
- You've resolved an incident and the traces are no longer interesting.

Don't prune while a failed stage-2 entry is still in the queue, or while investigating a specific run id.

## Recipes

```sh
ai-knowledge-base logs prune --dry-run
ai-knowledge-base logs prune --older-than 2w
ai-knowledge-base logs prune --older-than 1d
```

Change the project default:

```json
{ "schema_version": 1, "logsRetentionDays": 7 }
```

CLI flags win over settings per run.

## Output

```
• Deleted 12 log file(s) older than 30d (2026-04-11T10:00:00.000Z).
  • stage-2: 8/14 eligible — 4.2 MB
  • curator: 3/9 eligible — 1.1 MB
  • bootstrap-incremental: 1/2 eligible — 220 KB

✓ freed 5.5 MB across 3 bucket(s).
```

`X/Y eligible` means: of `Y` files scanned, `X` were older than the cutoff.

## Not pruned

- Files outside the three bucket directories.
- Non-`.jsonl` files (READMEs, manual notes).
- Files at the cutoff exactly or newer (strict less-than).

A session log's `stage_2_log` reference may point at a now-deleted file. Nothing in the pipeline reads stage-2 logs after the drain succeeds, but copy the file out of `_logs/` first if you want a forensic record.
