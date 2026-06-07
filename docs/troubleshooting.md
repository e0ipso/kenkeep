---
title: Troubleshooting
nav_order: 6
---

# Troubleshooting

Start with `npx kenkeep doctor --verbose`.

## Nothing is being captured

`.ai/kenkeep/_sessions/` stays empty.

- **Hooks aren't registered.** Check `.claude/settings.json` for the knowledge base hook entries. Re-run `init --upgrade` if missing.
- **A wrapper script around `claude` leaked the internal flag** (`KENKEEP_BUILDER_INTERNAL=1`) into a normal session.

## A hook seems to be silently doing nothing

Check `<kk-root>/_logs/hook-errors-YYYY-MM-DD.log` for the most recent day. Each line is a JSON object recording one swallowed hook failure, either a parse error (the harness sent malformed JSON) or an uncaught throw inside the hook, with the hook name, phase, and error message. The file is dated; rotation is implicit. Hooks always exit 0 by design, so this log is the primary breadcrumb when a hook appears to do nothing.

## Captured sessions never get extracted

Session logs are stuck pending.

- Background extraction runs at the start of the **next** Claude Code session. Open a new one.
- Make sure `claude` is on PATH in the shell that runs the hook.
- A stale `proposal-drain` lock can block extraction. Check `.ai/kenkeep/.state/state.json`; wait for the TTL (30 min) or clear the `lock` field manually. (Curate and bootstrap don't take a state lock — they run single-author in one host session.)

## `/kk-curate` says "no pending sessions"

Either everything is already curated, or some session logs have invalid frontmatter and are being silently skipped. Run `doctor`.

## Curator reported `add_collision` or `modify_missing_target` failures

- **`add_collision`**: the curator wanted to write a new node, but a node with that id already exists. Pick a different title for the candidate (re-run `/kk-curate` after deleting/editing the offending session log) or treat the existing node as the canonical version.
- **`modify_missing_target`**: the curator pointed at a `target_node_id` that's not on disk, usually because the node was renamed or deleted between captures. Either restore the target file or treat the modification as an addition by editing the session log so the next curate run reproposes it as `add`.

## `INDEX.md` is stale

`doctor` reports a hash drift. Cause: someone hand-edited or rebased `nodes/` without running the curator.

Fix:

```sh
npx kenkeep index rebuild
```

## Curator produces weird proposals

The prompt has drifted from your project's needs. Edit `.ai/kenkeep/.config/prompts/curator.md` and bump its `Version:` comment. See [Customization](internals/prompts.md).

## `treeify` refuses: "already in the tree layout"

`treeify` is a one-time migration. Once a knowledge base is in the tree layout (`schema_version: 2`, leaves in topical folders), `treeify` detects it and refuses rather than reshuffling an established tree. This is expected on a second run.

To reorganize an already-migrated tree, don't re-run `treeify`. Evolve nodes with `/kk-curate`, or move leaves by hand: ids are stable, so you can `git mv` a leaf into a different topical folder and run `npx kenkeep index rebuild` to refresh the index nodes.

## A `treeify` run looks half-done

`treeify` writes to disk and stops for review; it never commits. If a run is interrupted, the partial result is visible in `git status`. Because nothing was committed, you can discard the whole migration and return to the pre-migration state with:

```sh
git restore --staged --worktree .ai/kenkeep
```

The write primitive is all-or-nothing per run and never overwrites an existing target, so an interrupted `treeify` cannot clobber a node; the safe recovery is always `git restore`.

## Bootstrap re-processes done docs

`bootstrap-state.json` keys on file content hash. Causes:

- The file was actually modified (even whitespace).
- The state file was deleted or is malformed.

## Logs directory keeps growing

`_logs/` is gitignored but unbounded. Prune periodically:

```sh
npx kenkeep logs prune
```

This deletes `*.jsonl` files older than `logsRetentionDays` (default 30) across the whole `_logs/` tree.

## Reviewing changes to `nodes/`

The curator writes directly to `.ai/kenkeep/nodes/<kind>/<id>.md`. Review with `git diff nodes/`, your editor, or a tool like [self-review](https://github.com/e0ipso/self-review). Accept with `git commit` (the pre-commit hook regenerates and stages a fresh INDEX/GRAPH). Reject with `git restore <path>`.

## Resolving curator contradictions

Each contradiction lands as a markdown file under `.ai/kenkeep/conflicts/<id>.md` with `status: pending`; the existing node is never overwritten. Run `/kk-curate` and the skill walks each one with the `y`/`n`/`s`/`k` prompt (see [Daily use → Conflict walkthrough](daily-use.md#conflict-walkthrough)). To resolve by hand, edit the target node yourself and `git restore` (or `git commit`) the conflict file.

## `/kk-bootstrap` uses a lot of context on large repos

`/kk-bootstrap` reads every candidate doc into your harness session, so on a large doc tree (hundreds of markdown files) it can force a compaction mid-run, or in extreme cases exhaust the session's context window.

Remediation, in order of preference:

1. **Scope the run.** `/kk-bootstrap docs/` limits the walk to that subtree.
2. **Tighten `.kkignore`.** Add entries to deny large vendored or generated markdown subtrees.
3. **Run multiple smaller scopes one at a time** instead of one repo-wide pass.

On Claude Code and Cursor, drafting fans out to native sub-agents, which keeps each candidate doc out of the main session's context (see [Architecture → Parallel drafting and per-batch logs](internals/architecture.md#parallel-drafting-and-per-batch-logs)).

## Bootstrap is still sequential: why?

Per-harness support for native host sub-agents varies: **Claude Code** and **Cursor** ship a documented in-session `Task` tool and run the parallel path by default; **Codex** supports subagent dispatch at the workflow level (the exact in-LLM tool surface depends on your runtime); **opencode** is treated as a conservative fallback because its headless `run --format json` mode does not affirm Task-dispatch in current vendor docs. The `kk-bootstrap` and `kk-curate` skills probe their own tool surface at the start of each run and **silently degrade to inline sequential drafting** when no dispatch primitive is detected. This is by design, never an error, so a sequential run on an unsupported harness looks identical to a healthy parallel run from the outside.

To confirm which path actually ran, inspect the per-batch artefacts:

```sh
ls .ai/kenkeep/_logs/bootstrap/
```

You'll see one `<runId>__<batchN>.jsonl` per batch in either mode (the JSONL contract is the cross-harness lowest-common-denominator trace). The accompanying `<runId>__<batchN>.draft.json` files are only written by the parallel path. If they are missing while `.jsonl` files exist, the inline fallback ran. Same convention under `_logs/curator/` and `_logs/kk-add/`.



## When all else fails

```sh
npx kenkeep doctor --verbose
cat .ai/kenkeep/.state/state.json
ls .ai/kenkeep/_sessions/
ls .ai/kenkeep/_logs/*/
```

Then [file an issue](https://github.com/e0ipso/kenkeep/issues).
