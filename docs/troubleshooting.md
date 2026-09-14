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

## `ENTRY.md` is stale

Someone changed `nodes/` by hand, or restored a note after curate rebuilt the index.

```sh
npx kenkeep index rebuild
```

## Bootstrap re-reads docs it already processed

`.state/bootstrap-state.json` keys on content hash. The file changed, even by whitespace, or the state file was deleted or corrupted. Delete the state file to force a full re-run on purpose.

## `/kk-bootstrap` eats the context window

It reads every candidate doc into the session. On Claude Code and Cursor the drafting fans out to sub-agents, which keeps the docs out of the main context. Elsewhere, narrow the run:

1. `/kk-bootstrap docs/` limits the walk to one subtree.
2. Add large vendored or generated trees to `.kkignore`.
3. Run several small scopes instead of one big pass.

To see which path ran, look under `.ai/kenkeep/_logs/bootstrap/`. Every run writes `<runId>__<batchN>.jsonl`. Only the parallel path also writes `.draft.json` beside it.

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
