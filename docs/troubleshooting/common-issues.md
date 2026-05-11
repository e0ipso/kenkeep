---
title: Common issues
parent: Troubleshooting
nav_order: 1
---

# Common issues

Run `ai-knowledge-base doctor --verbose` first.

## Nothing is being captured

`_sessions/` is empty or not growing.

1. Hooks aren't registered. Check `.claude/settings.json` for `KB_BUILDER_HOOK=Stop|SessionEnd|PreCompact` entries. Re-run `init --force` if missing.
2. Gitleaks isn't on PATH. Capture aborts without it (security over availability). Run `pre-commit install`.
3. The 1s deadline fires on long transcripts. Usually a subsequent Stop/PreCompact recovers. File an issue if reproducible.
4. `KB_BUILDER_INTERNAL=1` leaked into a normal session via a `claude` wrapper.

## Stage-2 never runs

Session logs are stuck on `stage_2_status: pending`.

1. Stage-2 fires on the next `SessionStart`. Start a new session.
2. Check `_logs/stage-2/<session-id>__<ts>.jsonl`. If present but the log is still pending or `failed`, see [Reading stage-2 logs](reading-stage-2-logs.md).
3. Stale lock. Check `state.json`. Wait 30 min for TTL or delete the `lock` field.
4. `claude` not on PATH in the shell the hook runs in.

## Curate writes no proposals

`curate` reports "no pending sessions" while `_sessions/` has stage-2-done logs.

1. They're already curated (`curator_processed_at` is set). Run `status` to see buckets.
2. Frontmatter is invalid and the log is being silently skipped. Run `doctor`; inspect the log header.

## Curator produces weird proposals

Prompt drift.

1. Read `_logs/curator/<run-id>__<ts>.jsonl`. See [Reading curator logs](reading-curator-logs.md).
2. Tune `.ai/knowledge-base/.state/prompts/curator.md`. Bump the `Version:` comment.

## INDEX.md is stale

`doctor` reports `nodes_hash drift`. Cause: hand-edit or rebase to `nodes/` without a curate pass.

Fix: `ai-knowledge-base index rebuild`.

## Dangling `derived_from`

Warning, not an error. Causes:

1. Session log was deleted (`_sessions/` is gitignored).
2. Source doc was moved or renamed.
3. Typo in the node's frontmatter.

The consume path silently ignores dangling refs.

## Can't accept a contradiction

Contradictions need `suggested_resolution`. Re-step through `proposals review` and pick `supersede`, `keep_both`, or `reject`.

## Bootstrap re-processes done docs

`bootstrap-state.json` records the SHA-256 of every processed doc.

1. File was deleted: next run starts fresh.
2. File is malformed: the CLI treats it as missing.
3. The doc actually changed (whitespace counts).

## Too much context noise

Tune `indexBudgetTokens` lower. The full edge listing is still in `GRAPH.md`.

If proposals themselves are noisy, tighten the "what to skip" sections of the [stage-2](../customization/stage-2-prompt.md), [curator](../customization/curator-prompt.md), and [bootstrap](../customization/bootstrap-incremental-prompt.md) prompts.

## When all else fails

1. `ai-knowledge-base doctor --verbose`
2. `cat .ai/knowledge-base/.state/state.json`
3. `cat .ai/knowledge-base/_sessions/.queue.json`
4. `ls .ai/knowledge-base/_logs/*/`
5. File an issue at the [GitHub repo](https://github.com/e0ipso/ai-knowledge-base/issues).
