---
title: Troubleshooting
nav_order: 6
---

# Troubleshooting

Start with `npx @e0ipso/ai-knowledge-base doctor --verbose`.

## Nothing is being captured

`.ai/knowledge-base/_sessions/` stays empty.

- **Hooks aren't registered.** Check `.claude/settings.json` for the KB hook entries. Re-run `init --upgrade` if missing.
- **secretlint failed to load.** Capture refuses to write when the bundled secret scanner can't initialize. Re-install `@e0ipso/ai-knowledge-base` and confirm `node -e "import('@secretlint/core')"` resolves.
- **A wrapper script around `claude` leaked the internal flag** (`KB_BUILDER_INTERNAL=1`) into a normal session.

## A hook seems to be silently doing nothing

Check `<kb-root>/_logs/hook-errors-YYYY-MM-DD.log` for the most recent day. Each line is a JSON object recording one swallowed hook failure — either a parse error (the harness sent malformed JSON) or an uncaught throw inside the hook — with the hook name, phase, and error message. The file is dated; rotation is implicit. Hooks always exit 0 by design, so this log is the primary breadcrumb when a hook appears to do nothing.

## Captured sessions never get extracted

Session logs are stuck pending.

- Background extraction runs at the start of the **next** Claude Code session. Open a new one.
- Make sure `claude` is on PATH in the shell that runs the hook.
- A stale `proposal-drain` lock can block extraction. Check `.ai/knowledge-base/.state/state.json`; wait for the TTL (30 min) or clear the `lock` field manually. (Curate and bootstrap no longer hold a state lock — they run in a single host session, single-author by design.)

## `curate` says "no pending sessions"

Either everything is already curated, or some session logs have invalid frontmatter and are being silently skipped. Run `doctor`.

## Curator reported `add_collision` or `modify_missing_target` failures

- **`add_collision`**: the curator wanted to write a new node, but a node with that id already exists. Pick a different title for the candidate (rerun curate after deleting/editing the offending session log) or treat the existing node as the canonical version.
- **`modify_missing_target`**: the curator pointed at a `target_node_id` that's not on disk, usually because the node was renamed or deleted between captures. Either restore the target file or treat the modification as an addition by editing the session log so the next curate run reproposes it as `add`.

## `INDEX.md` is stale

`doctor` reports a hash drift. Cause: someone hand-edited or rebased `nodes/` without running the curator.

Fix:

```sh
npx @e0ipso/ai-knowledge-base index rebuild
```

## Curator produces weird proposals

The prompt has drifted from your project's needs. Edit `.ai/knowledge-base/.config/prompts/curator.md` and bump its `Version:` comment. See [Customization](internals/prompts.md).

## Bootstrap re-processes done docs

`bootstrap-state.json` keys on file content hash. Causes:

- The file was actually modified (even whitespace).
- The state file was deleted or is malformed.

## Logs directory keeps growing

`_logs/` is gitignored but unbounded. Prune periodically:

```sh
npx @e0ipso/ai-knowledge-base logs prune
```

This deletes `*.jsonl` files older than `logsRetentionDays` (default 30) across the whole `_logs/` tree.

## Reviewing changes to `nodes/`

The curator writes directly to `.ai/knowledge-base/nodes/<kind>/<id>.md`. Review with `git diff nodes/`, your editor, or a tool like [self-review](https://github.com/e0ipso/self-review). Accept with `git commit` (the pre-commit hook regenerates and stages a fresh INDEX/GRAPH). Reject with `git restore <path>`.

## Resolving curator contradictions

Each contradiction lands as a markdown file under `.ai/knowledge-base/conflicts/<id>.md` with `status: pending`; the existing node is never overwritten. Run `/kb-curate` and the skill walks each one with the `y`/`n`/`s`/`k` prompt (see [Daily use → Conflict walkthrough](daily-use.md#conflict-walkthrough)). To resolve by hand, edit the target node yourself and `git restore` (or `git commit`) the conflict file.

## `bootstrap-incremental: command not found` or "deprecated" warning

The command was renamed: `bootstrap-incremental` → `bootstrap`. The old name is registered as a deprecation alias for one release and prints a stderr notice on every invocation:

```
[deprecated] Alias for `bootstrap`; will be removed in the next release. Use `ai-knowledge-base bootstrap` instead.
```

The alias is removed in the release after next. Update any scripts, CI workflows, and shell aliases that hardcode the old name. The flags (`--from <scope>`) match the new command.

## `bootstrap` now uses more context — what changed

Previously, `bootstrap-incremental` spawned a fresh `claude -p` sub-agent per batch, so the host harness session paid almost no context cost. The current architecture runs the bootstrap skill **inside the host harness session**, so every candidate doc the skill reads counts against the host session's context window.

For small repos this is invisible. For large doc trees (a monorepo with hundreds of markdown files) this can force a host-side compaction mid-run, or — in extreme cases — exhaust the model's effective window.

Remediation, in order of preference:

1. **Scope the run with `--from <subdir>`.** `npx @e0ipso/ai-knowledge-base bootstrap --from docs/` limits the walk to that subtree.
2. **Tighten `.kbignore`.** Add entries to deny large vendored or generated markdown subtrees. Run `finddocs` to preview what the new ignore list lets through.
3. **Run multiple smaller scopes one at a time** instead of one repo-wide pass.

The single-host-session model is intentional and is not coming back to a parallel-sub-agent architecture — see [Daily use → Host-context cost on large doc trees](daily-use.md#host-context-cost-on-large-doc-trees) and the changelog for the rationale.

## When all else fails

```sh
npx @e0ipso/ai-knowledge-base doctor --verbose
cat .ai/knowledge-base/.state/state.json
ls .ai/knowledge-base/_sessions/
ls .ai/knowledge-base/_logs/*/
```

Then [file an issue](https://github.com/e0ipso/ai-knowledge-base/issues).
