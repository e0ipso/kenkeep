---
title: Troubleshooting
nav_order: 6
---

# Troubleshooting

Start with `ai-knowledge-base doctor --verbose`.

## Nothing is being captured

`.ai/knowledge-base/_sessions/` stays empty.

- **Hooks aren't registered.** Check `.claude/settings.json` for the KB hook entries. Re-run `init --force` if missing.
- **secretlint isn't installed.** Capture refuses to write when the secret scanner can't load. Run `npm install` (the project's devDeps include `secretlint` and the recommended preset after `init`).
- **A wrapper script around `claude` leaked the internal flag** (`KB_BUILDER_INTERNAL=1`) into a normal session.

## Captured sessions never get extracted

Session logs are stuck pending.

- Background extraction runs at the start of the **next** Claude Code session. Open a new one.
- Make sure `claude` is on PATH in the shell that runs the hook.
- A stale lock can block extraction. Check `.ai/knowledge-base/.state/state.json`; wait for the TTL (30 min) or clear the `lock` field manually.

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

The curator never overwrites a node it conflicts with. Conflicts land in `.ai/knowledge-base/.state/pending-conflicts.json` and surface in `ai-knowledge-base status`. Run `/kb-curate` and the skill will walk each entry with you (existing node side-by-side with the new claim) and let you choose: Replace (delete the existing node file and write the proposed one) or Reject (do nothing). The skill applies your decision and removes the entry from the file.

If you'd rather resolve manually: read `pending-conflicts.json`, edit (or delete) the relevant node yourself, then remove the entry from the JSON array.

## When all else fails

```sh
npx @e0ipso/ai-knowledge-base doctor --verbose
cat .ai/knowledge-base/.state/state.json
ls .ai/knowledge-base/_sessions/
ls .ai/knowledge-base/_logs/*/
```

Then [file an issue](https://github.com/e0ipso/ai-knowledge-base/issues).
