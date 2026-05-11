---
title: Reading stage-2 logs
parent: Troubleshooting
nav_order: 1
---

# Reading the stage-2 log

When stage-2 produces something unexpected, the full LLM trace is under `.ai/knowledge-base/_logs/stage-2/`. Files are JSONL — one JSON event per line — written by `claude -p --output-format stream-json --verbose`.

## Finding the relevant log

Each session log records its log path in the `stage_2_log` frontmatter field:

```yaml
stage_2_status: done
stage_2_completed_at: 2026-05-11T10:00:00.000Z
stage_2_log: _logs/stage-2/abc123__20260511T100000Z.jsonl
```

The path is relative to `.ai/knowledge-base/`.

## Anatomy of a stream-json log

A typical log has these lines, in order:

| Line | Purpose | Notes |
|---|---|---|
| `{"type": "system", "subtype": "init", ...}` | Records the session id and the model the spawned `claude -p` actually used. | Use this to confirm which model produced the output. |
| `{"type": "assistant", "message": {"content": [...]}}` (zero or more) | Each intermediate assistant turn. The extractor is single-pass, so usually only one or two of these. | The `content` is an array of blocks; text blocks have `{"type": "text", "text": "..."}`. |
| `{"type": "user", "message": {"content": [...]}}` (occasional) | Only present if the prompt or stdin triggered a follow-up. | The extractor prompt is designed to produce a single response, so this is usually absent. |
| `{"type": "result", "subtype": "success" \| "error", "is_error": bool, "result": "..."}` | The final message. The drain reads `result` as JSON and validates it against the stage-2 schema. | If `is_error: true`, the drain treats the run as failed regardless of content. |

## Common failure patterns

### "claude subprocess produced no final result message"

The log has no `type: result` line. Causes:

- The spawned `claude` was killed before completing — usually a timeout (default 60 s). Check the wall-clock timestamps of the first and last events.
- A non-zero exit code from the CLI. Run `claude --version` and verify your auth is still valid.

Recovery: the entry stays in the queue with `attempts` incremented and retries on the next session start. Three failures in a row mark the session log as `skipped`.

### "stage-2 output did not match schema: …"

The drain parsed the final `result` text as JSON but Zod rejected it. The most common cause is the model emitting extra prose before/after the JSON or skipping a required field (`tags`, `confidence`).

Recovery options:

1. Inspect the offending `result` text in the log. If the model is consistently producing the wrong shape, the prompt may need tuning — see [Editing the stage-2 prompt](../customization/stage-2-prompt.md).
2. If it's a one-off, just let the drain retry on the next session.

### "failed to parse final result as JSON"

The `result` text isn't parseable JSON — the model emitted prose only. Same recovery as a schema mismatch.

### A session log is marked `skipped`

The drain exhausted 3 attempts and gave up. The session log is preserved (you can still read the redacted transcript), but it will never produce proposals via the drain. To force a re-extraction:

1. Manually flip the session log's frontmatter: `stage_2_status: pending`, clear `stage_2_error`.
2. Re-add it to `.ai/knowledge-base/_sessions/.queue.json` (or use the M3 `/kb-propose-from-session` skill once that ships).

## Log retention

Logs grow without bound. v1.5 will ship `ai-knowledge-base logs prune --older-than <duration>`. For now, the directory is gitignored, so the only consequence is local disk usage — feel free to delete old subdirectories manually.

## Privacy note

The stream-json log contains the **redacted** transcript slice (the same content that goes into `_sessions/<id>.md`). Secrets that gitleaks caught in stage 1 are also redacted here. Secrets gitleaks missed could appear in the log — treat `_logs/` with the same care as `_sessions/`. Both are gitignored by default.
