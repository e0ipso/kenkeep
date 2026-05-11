---
title: Reading stage-2 logs
parent: Troubleshooting
nav_order: 1
---

# Reading stage-2 logs

Per-entry stream-json traces live under `.ai/knowledge-base/_logs/stage-2/`. The session log records its trace path in `stage_2_log`.

## Anatomy

| Line type | What it is |
|---|---|
| `system / init` | Records session id and resolved model. |
| `assistant` | Intermediate streamed turns. Usually one or two. |
| `user` | Rare follow-ups. |
| `result` | Final message. `result` text is parsed as JSON and validated against `Stage2OutputSchema`. |

If `is_error: true` on the final result, the drain treats the run as failed.

## Common failures

### No final result message

`claude` was killed or exited non-zero, usually a timeout (default 60s). Check the first/last event timestamps. Verify auth with `claude --version`. The entry retries on the next session; three failures mark it `skipped`.

### Output didn't match schema

The model emitted extra prose or skipped a required field. Inspect the `result` text. If it's consistent, tune the [stage-2 prompt](../customization/stage-2-prompt.md). One-offs sort themselves out on retry.

### Final result wasn't JSON

Same recovery as a schema mismatch.

### Log is `skipped`

Three attempts failed. To force re-extraction:

1. Edit the session log frontmatter: `stage_2_status: pending`, clear `stage_2_error`.
2. Re-add the path to `_sessions/.queue.json`.

## Retention

Logs accumulate. Use `ai-knowledge-base logs prune` to bound growth.

## Privacy

Logs contain the **redacted** transcript. Secrets gitleaks caught are redacted; secrets it missed could appear. Treat `_logs/` with the same care as `_sessions/`. Both gitignored by default.
