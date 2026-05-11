---
title: Reading _logs/curator/
parent: Troubleshooting
nav_order: 2
---

# Reading `_logs/curator/`

Every `ai-knowledge-base curate` invocation writes a stream-json trace to `.ai/knowledge-base/_logs/curator/<run-id>__<timestamp>.jsonl`. The run id is a ULID generated at the start of the run; the timestamp is wall-clock UTC compact form.

These logs are gitignored by default — they belong to the contributor's machine.

## Anatomy of the log

Each line is one JSON event from the spawned `claude -p` subprocess. The interesting types are:

| `type` | What it tells you |
|---|---|
| `assistant` | Streamed reasoning / commentary from the curator |
| `tool_use` | A `Read` call against an existing node (the curator's only allowed tool) |
| `tool_result` | Output of the `Read` call |
| `result` | The final message. `result` field is the JSON array of CuratorActions |

The drain validates the `result` event's content against `CuratorOutputSchema`. If validation fails, the curator surfaces the schema error and exits non-zero; the proposals for that batch are not written.

## When the curator misbehaves

1. **Empty proposals folder after `curate` reports `proposalsWritten: N > 0`.** Check the log for a final `result` event with `is_error: true`. The drain treats any `is_error` final result as a parse failure.

2. **Curator produced fenced JSON.** `runHeadlessClaude` tolerates ` ```json ... ``` ` wrappers around the final result. If the model wraps the JSON in extra commentary, the parse step strips the fence; if no fence is present but there's preamble, the parser falls back to the raw string and validation will fail. Inspect the log's final `result.result` field directly.

3. **Same proposal appears twice in different batches.** Cross-batch dedup keeps the higher-confidence action per `proposed_node.id`. If you see duplicates that survived dedup, both had different ids — check whether the slugification was inconsistent in the curator's output (case, hyphen runs, accents).

4. **Curator auto-resolved a contradiction.** The persistence layer always writes `suggested_resolution: null`, regardless of what the model emitted. Confirm by reading the proposal file's frontmatter. If a non-null value appears, the prompt or the persistence path has regressed.

## Re-running a single batch

There is no first-class "re-run batch N" command in v1. Instead:

1. Manually clear the `curator_processed_at` and `curator_run_id` fields from the affected session log frontmatter (use any text editor).
2. Re-run `ai-knowledge-base curate`. The session log will be picked up again and re-curated.

The original log under `_logs/curator/` is left in place — its filename includes the original run id, so old and new logs do not collide.
