---
title: Reading curator logs
parent: Troubleshooting
nav_order: 2
---

# Reading curator logs

Every `curate` run writes `_logs/curator/<run-id>__<ts>.jsonl`. Gitignored.

## Anatomy

| `type` | What it is |
|---|---|
| `assistant` | Streamed reasoning. |
| `tool_use` | A `Read` against an existing node (curator's only allowed tool). |
| `tool_result` | Output of the `Read`. |
| `result` | Final message. Validated against `CuratorOutputSchema`. |

A validation failure surfaces the schema error and exits non-zero; the batch's proposals are not written.

## Common issues

1. **Empty proposals folder despite `proposalsWritten: N > 0`**. Check the final `result` for `is_error: true`. Treated as a parse failure.
2. **Fenced JSON**. `runHeadlessClaude` strips ` ```json ... ``` ` fences. Preamble without a fence falls through to raw parsing and fails validation. Inspect the final `result.result` field.
3. **Duplicates after dedup**. Cross-batch dedup keeps the higher-confidence action per `proposed_node.id`. Duplicates mean inconsistent slugification (case, hyphens, accents) produced different ids.
4. **Auto-resolved contradiction**. The persistence layer forces `suggested_resolution: null` regardless of model output. If a non-null value appears in the file, the prompt or persistence has regressed.

## Re-running a single batch

No first-class command in v1. Workaround:

1. Clear `curator_processed_at` and `curator_run_id` from the affected session log.
2. Re-run `curate`. The log is picked up again.

The original log under `_logs/curator/` stays in place; its run id is unique.
