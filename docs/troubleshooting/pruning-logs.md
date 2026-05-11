---
title: Pruning logs
parent: Troubleshooting
nav_order: 4
---

# Pruning logs

`.ai/knowledge-base/_logs/` accumulates a stream-json trace per stage-2 entry, curator run, and bootstrap-incremental run. The directory is gitignored, but it can grow without bound on a long-lived repo. `ai-knowledge-base logs prune` is the manual housekeeping tool.

## When to prune

You probably want to prune when:

- `du -sh .ai/knowledge-base/_logs/` reports more than a few hundred megabytes.
- You're packaging the repo (e.g. for a tarball) and want a small payload.
- You just resolved a stage-2 incident and the per-attempt traces are no longer interesting.

You do **not** want to prune when:

- A failed stage-2 entry is still in the queue (`ai-knowledge-base status` shows non-zero). The trace files are how you debug what the model did.
- You're investigating a regression that you traced to a specific run-id — those logs are your evidence.

## Recipes

Show what would be removed without touching anything:

```sh
ai-knowledge-base logs prune --dry-run
```

Prune everything older than two weeks:

```sh
ai-knowledge-base logs prune --older-than 2w
```

Override the default retention to one day for a hot CI job:

```sh
ai-knowledge-base logs prune --older-than 1d
```

Drop the default retention permanently to seven days for everyone on the project — edit `.ai/knowledge-base/.config.json`:

```json
{
  "schema_version": 1,
  "logsRetentionDays": 7
}
```

Subsequent `ai-knowledge-base logs prune` invocations (without `--older-than`) will use this as the default. CLI flags still win when present.

## Output

Per-bucket counts and freed bytes:

```
• Deleted 12 log file(s) older than 30d (2026-04-11T10:00:00.000Z).
  • stage-2: 8/14 eligible — 4.2 MB
  • curator: 3/9 eligible — 1.1 MB
  • bootstrap-incremental: 1/2 eligible — 220 KB

✓ freed 5.5 MB across 3 bucket(s).
```

`X/Y eligible` means: of `Y` files scanned in the bucket, `X` had an mtime older than the cutoff and were deleted. Each bucket reports independently; an empty bucket simply lists `0/0 eligible — 0 B`.

## What is NOT pruned

- Files outside the three bucket directories (`_logs/<anything-else>/`) — only `stage-2/`, `curator/`, `bootstrap-incremental/` are walked.
- Non-`.jsonl` files (READMEs, manual notes you dropped in).
- Files whose mtime is at the cutoff exactly or newer (strict less-than comparison).

The frontmatter `stage_2_log` reference on a session log keeps pointing at the now-deleted file. Today, that just means the consumer's "open the log" workflow becomes "the log isn't here anymore" — nothing in the pipeline reads stage-2 logs after the drain succeeds. If you need a guaranteed forensic record, copy the relevant log file out of `_logs/` before pruning.
