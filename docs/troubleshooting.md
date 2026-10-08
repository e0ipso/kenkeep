---
title: Troubleshooting
nav_order: 7
---

# Troubleshooting

Start with `npx kenkeep doctor --verbose`. Then find your symptom below.

## Nothing is captured

`.ai/kenkeep/_sessions/` stays empty.

- The hooks are not registered, or the scripts are missing because this clone never ran `init`. Run `npx kenkeep init --harnesses <id>` (add `--upgrade` on an existing install).
- On Codex, you have not trusted the hooks yet. Run `/hooks` in a Codex session.
- A wrapper around the assistant leaked `KENKEEP_BUILDER_INTERNAL=1` into a normal session. That variable tells every hook to exit.

## A hook seems to do nothing

Hooks always exit 0. Their failures go to `.ai/kenkeep/_logs/hook-errors-YYYY-MM-DD.log`, one JSON line each with the hook name, phase, and error. Read the latest file.

## Captures stay `pending`

On Codex, Cursor, OpenCode, and Copilot, extraction runs in the background at the start of the next session. Open one. The assistant binary must be on PATH for the shell that runs the hook.

A session whose transcript grew after you curated it goes back to `pending`, and only its new turns are extracted again. A log whose extraction finished against an older transcript is left pending, not overwritten: the capture that landed during extraction wins.

A drain killed mid-run leaves a lock that clears itself after a minute. To clear it now, delete the `.ai/kenkeep/.state/state.json.lock` directory.

On Claude Code there is no background extraction. `/kk-curate` extracts inline.

## `/kk-curate` reports no pending sessions

Everything is curated, or some session logs have invalid frontmatter and are skipped. `doctor` names them. Files must end in `.md` and carry `proposal_status: pending`.

## `/kk-curate` asks which harness to use

Detection failed and more than one harness is installed. Run from the harness you installed, or pass `--harness <id>`.

## `/kk-curate` fails with `EBUSY`

Some Cursor environments fail a direct `node` call with `EBUSY`. The skill retries the same command through Python and usually recovers. If it fails both ways, check that `npx --yes kenkeep@latest status` works in a plain terminal.

## `add_collision` or `modify_missing_target`

- `add_collision`: a note with that id already exists. Retitle the candidate, or treat the existing note as canonical.
- `modify_missing_target`: the note the curator wanted to modify was renamed or deleted. Restore it, or let the next run re-propose the change as an add.

## A `curate-persist` action failed

The summary names the action and the reason, exits non-zero, and keeps every write that succeeded. Fix the cause (usually a missing modify target or an unwritable folder), then rerun the same command on the same survivors file. Actions whose note already exists with the same content report `already-applied` and are skipped, so nothing is written twice. Do not write the note by hand.

## A conflict is rejected as legacy

`conflict prepare` and `conflict resolve` refuse an open conflict file that predates `schema_version: 2`, because it lacks the full proposal. Edit the target note yourself from the file's `## Proposed node` section, run `npx kenkeep index rebuild`, then delete the conflict file or set `status: kept` in its frontmatter.

## `ENTRY.md` is stale

Someone changed `nodes/` by hand, or restored a note after curate rebuilt the index.

```sh
npx kenkeep index rebuild
```

## Bootstrap re-reads docs it already processed

`.state/bootstrap-state.json` keys on content hash. A document counts as done only after `bootstrap complete-doc` records it. Either the file changed, even by whitespace, or the state file was deleted or corrupted, or the previous run stopped before `bootstrap complete-doc` finalized the document. That last case is expected: the document sits under `in_progress` and the next run resumes it without writing duplicate notes. Delete the state file to force a full re-run on purpose.

## `/kk-bootstrap` eats the context window

It reads every candidate doc into the session. On Claude Code and Cursor the drafting fans out to sub-agents, which keeps the docs out of the main context. Elsewhere, narrow the run:

1. `/kk-bootstrap docs/` limits the walk to one subtree.
2. Add large vendored or generated trees to `.kkignore`.
3. Run several small scopes instead of one big pass.

To see which path ran, look under `.ai/kenkeep/_logs/bootstrap/`. Every run writes `<runId>__<batchN>.jsonl`. Only the parallel path also writes `.draft.json` beside it.

## `lint` reports `stale-rendered-link`

A note's generated Related or Citations links no longer match where its targets live, usually after a hand move. Run `npx kenkeep node refresh-links`, then review the diff. Rebalance, `node sweep`, and `pack import` already refresh the links of the notes they touch.

## A note disappeared after `init --upgrade`

The upgrade sweeps loose notes at the root of `nodes/`. A note nothing links to and no folder fits is deleted when git can restore it, and the output printed the `git restore -- <path>` command. Run it to get the note back. A note git cannot restore byte for byte (untracked, edited since it was staged or committed, or flagged `assume-unchanged` or `skip-worktree`) is never deleted; it stays at the root.

## `init` reports an older schema

The notes under `.ai/kenkeep/nodes/` are at `schema_version` 1 or 2. `init` finishes and leaves them alone, but every command that reads them fails. Run `/kk-migrate` in a session. Folder names do not count: a `map/` or `practice/` folder is an ordinary topic folder.

## `doctor --harness <id>` says `<id>` is not recorded

The harness is registered in the repo but missing from `.ai/kenkeep/.state/installed-version`, or its scripts are missing after a clone. Run `npx kenkeep init --harnesses <id>`.

## `pack import` or `pack export` refuses

- Import stops on a symlink inside the pack, a note id that matches one of yours (live or retired), an edge that resolves to nothing, or a redirects file that conflicts with yours. Nothing is written. See [Knowledge packs](knowledge-packs.md#import-a-pack).
- Import refuses to start outside a git work tree, or while `.ai/kenkeep/` or `AGENTS.md` has uncommitted or untracked changes, because it relies on git to undo a failed run. Commit or stash the listed paths first.
- Import that fails on a write prints the `git restore` and `git clean` commands that undo it. Run them, fix the cause, and import again.
- Export refuses a symlinked output, a non-empty directory with no `kenkeep-pack.yaml`, and a path inside `.ai/kenkeep`. Use a new or empty directory, or a previous export.

## A hook runs slowly

Hook deadlines are cooperative. The prompt-time hook checks its 1 second budget between notes and injects nothing once it is spent, but one very large note can still overrun by its own read time. See [Hooks](internals/hooks.md#hook-budgets).

## Curator proposals are off

Edit `.ai/kenkeep/.config/prompts/proposal-extract.md` and bump its `Version:` comment. See [Prompts and schemas](internals/prompts.md).

## Logs keep growing

`_logs/` is gitignored and unbounded. `npx kenkeep logs prune` deletes JSONL files older than `logsRetentionDays`.

## When all else fails

```sh
npx kenkeep doctor --verbose
cat .ai/kenkeep/.state/state.json
ls .ai/kenkeep/_sessions/
ls .ai/kenkeep/_logs/*/
```

Then [file an issue](https://github.com/e0ipso/kenkeep/issues).
