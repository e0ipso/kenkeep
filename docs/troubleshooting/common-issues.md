---
title: Common issues
parent: Troubleshooting
nav_order: 1
---

# Common issues

Each symptom links to the diagnostic command(s) that will confirm or rule out the cause. Run `ai-knowledge-base doctor --verbose` first for almost any problem — it surfaces nine common conditions and exits non-zero only on hard errors.

## "Nothing is being captured."

`ls .ai/knowledge-base/_sessions/` is empty or hasn't grown.

Likely causes, in order:

1. **The hooks aren't registered.** Open `.claude/settings.json` and look for `KB_BUILDER_HOOK=Stop` / `…=SessionEnd` / `…=PreCompact` entries. Missing? Run `ai-knowledge-base init --assistants claude --force`.
2. **gitleaks isn't on PATH.** Capture aborts when gitleaks isn't available — the security guarantee outweighs availability. Run `ai-knowledge-base doctor`; if you see `gitleaks on PATH: not found on PATH …`, `pre-commit install` and re-run.
3. **The 1-second deadline is firing.** Very long transcripts or a slow filesystem can push capture past the deadline; the hook exits silently. You'll usually still capture on the next Stop or PreCompact event. If this is happening reproducibly, file an issue.
4. **`KB_BUILDER_INTERNAL=1` is set.** This is the recursion guard. If you've wrapped `claude` in a script, make sure the wrapper doesn't propagate this env var into normal sessions.

## "Capture worked but stage-2 never runs."

`_sessions/<log>.md` shows `stage_2_status: pending` indefinitely.

Stage-2 runs on the next `SessionStart`, asynchronously. So:

1. **Start a new session.** The `kb-stage2-drain.mjs` hook fires on session start. If the drain succeeds, the log moves to `stage_2_status: done` and proposals get populated.
2. **Check `_logs/stage-2/<session-id>__<ts>.jsonl`.** If the file exists but the session is still `pending` or moved to `failed`, the drain ran but encountered an error. Read [Reading stage-2 logs](reading-stage-2-logs.md).
3. **Check the lock.** `cat .ai/knowledge-base/.state/state.json`. If `lock.name: stage2-drain` with a stale PID, the previous drain crashed — the lock will be reclaimed after 30 minutes, or you can delete the `lock` field manually.
4. **Verify `claude` is on PATH** in the same shell environment Claude Code uses to spawn hooks. `ai-knowledge-base doctor` runs `claude --version` and reports.

## "Curate writes no proposals."

`ai-knowledge-base curate` prints `no pending sessions` even though `_sessions/` has stage-2-done logs.

1. **The sessions are already curated.** Curated logs carry a `curator_processed_at` frontmatter field; `listPendingSessions` filters them out. This is the expected end state — pending only means "stage-2 done, not yet seen by the curator." Run `ai-knowledge-base status` to see the buckets.
2. **The schema is invalid.** A hand-edited session log that no longer validates against `SessionLogFrontmatterSchema` will be silently skipped. Run `ai-knowledge-base doctor`; check the log itself with `head <log>.md`.

## "The curator wrote weird proposals."

Most of the time this is prompt drift. Two things to do:

1. **Read the run log.** `_logs/curator/<run-id>__<ts>.jsonl` has the full stream-json trace. See [Reading curator logs](reading-curator-logs.md) for how to parse it.
2. **Tune the curator prompt.** Edit `.ai/knowledge-base/.state/prompts/curator.md` (your local override). Bump the `Version: N` comment when you change behavior. The calibration loop is documented in [Editing the curator prompt](../customization/curator-prompt.md).

## "INDEX.md is stale."

Doctor says `INDEX.md is fresh: stale (nodes_hash drift)`. The SessionStart hook also appends a `> KB index is stale …` line to the injected context.

Cause: someone hand-edited a node file (or rebased changes that touched `nodes/`) without running a curator pass.

Fix: `ai-knowledge-base index rebuild`.

The curator regenerates INDEX/GRAPH at the end of every run, so this only happens after manual edits or rebases. The pre-commit hook can be configured to block commits with stale INDEX — see [Reference > Settings](../reference/settings.md).

## "doctor warns about dangling derived_from."

`ai-knowledge-base doctor --verbose` lists `<node-id>: <ref>` pairs.

Three flavors of cause:

1. **Session log was deleted.** `_sessions/` is gitignored — if you wiped `.ai/knowledge-base/_sessions/` to clean up, every node derived from those sessions now has dangling refs. This is fine; the warning is informational. The consume path silently ignores dangling refs.
2. **Source doc moved.** A bootstrap-derived node's `derived_from: docs/architecture/auth.md` is now invalid because the doc was renamed. Either update the node manually, or accept the warning as documentation of the move.
3. **Reference is a typo.** Hand-edited the node, fat-fingered the path. Fix the path in the node frontmatter.

Dangling references are never an error — they're a warning. The curator treats them as "evidence not available" and proceeds.

## "Proposals review can't accept a contradiction."

Contradiction proposals require a `suggested_resolution` (`supersede`, `keep_both`, or `reject`). The curator always emits `null` there; the reviewer must choose. If the TUI seems stuck, you may have skipped that prompt — re-run `ai-knowledge-base proposals review` and step through that proposal explicitly.

## "Bootstrap re-processes docs I've already done."

`.ai/knowledge-base/.state/bootstrap-state.json` records SHA-256 of every processed doc. If a re-run is processing them again:

1. **The file was deleted.** Check `cat .ai/knowledge-base/.state/bootstrap-state.json`. If missing, the next run starts fresh.
2. **The file is malformed.** Doctor doesn't currently check the bootstrap state file — if it's hand-edited to an invalid shape, the runtime falls back to an empty state. Fix the JSON.
3. **The doc actually changed.** Even whitespace counts. `git diff` against the last bootstrap-commit timestamp to see what shifted.

## "The KB feels noisy / the assistant gets too much context."

Tune the INDEX token budget. `ai-knowledge-base index rebuild --budget-tokens 1000` re-renders INDEX at a tighter budget; oldest entries per kind get trimmed and a footer reports the hidden count. The full edge listing is still in `GRAPH.md` for the assistant to read explicitly.

If the noise is in the content itself (proposals that should never have been written), tighten the prompts in `.ai/knowledge-base/.state/prompts/`. The "what to skip" sections in [stage-2](../customization/stage-2-prompt.md), [curator](../customization/curator-prompt.md), and [bootstrap-incremental](../customization/bootstrap-incremental-prompt.md) prompts are the right levers.

## When all else fails

1. `ai-knowledge-base doctor --verbose` — comprehensive checks.
2. `cat .ai/knowledge-base/.state/state.json` — current lock + last_nudged_at.
3. `cat .ai/knowledge-base/_sessions/.queue.json` — pending stage-2 entries.
4. `ls .ai/knowledge-base/_logs/*/` — find the most recent run log; read it.
5. File an issue at [the GitHub repo](https://github.com/e0ipso/ai-knowledge-base/issues) with the doctor output and the relevant log snippets.
