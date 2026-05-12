---
title: Daily use
nav_order: 4
---

# Daily use

After install, the only thing you do by hand is **curate**, **review**, and **commit**. Everything else is automatic.

## The loop

1. Code with Claude Code as usual.
2. When you see the curate nudge (or whenever you feel like it), run `/kb-curate`.
3. If the curator reports any contradictions, the skill walks you through each one in-session and applies your chosen resolution.
4. Inspect the resulting changes under `.ai/knowledge-base/nodes/` with `git diff` (or your preferred diff tool, e.g. [self-review](https://github.com/e0ipso/self-review)).
5. `git commit` what you want to keep; `git restore <path>` to discard.

The pre-commit hook regenerates `INDEX.md` and `GRAPH.md` and stages them into the same commit, so the injected index never drifts from the committed nodes.

## Curate

In a Claude Code session:

```
/kb-curate
```

Or from a shell:

```sh
ai-knowledge-base curate
```

The curator reads every captured session that's been processed but not yet curated and applies its decisions directly to `nodes/`:

- **add** → writes `nodes/<kind>/<id>.md`. Fails loud if the file already exists.
- **modify** → overwrites the target node. Fails loud if `target_node_id` is missing on disk.
- **contradict** → records the conflict in `.ai/knowledge-base/.state/pending-conflicts.json` and writes nothing.
- **drop** → no change.

The curator never auto-resolves a contradiction. The `/kb-curate` skill walks each entry in `pending-conflicts.json` with you in-session and applies your choice (supersede, keep both, reject) by editing the affected node, then removes the resolved entry.

## Review changes

The KB lives in `nodes/`. Review with `git diff nodes/`, your editor, or a tool like [self-review](https://github.com/e0ipso/self-review). They are important — they may affect how the agent behaves in every future session.

To accept: `git add` and `git commit`. The lint-staged pre-commit hook regenerates and stages `INDEX.md`/`GRAPH.md` so the injected index stays in lockstep.

To reject: `git restore nodes/<kind>/<file>.md` (or delete the file if it's a new addition).

For curator-detected contradictions, let the `/kb-curate` skill walk you through them — that's the authoritative resolution path.

## Add knowledge manually

Sometimes you know exactly what you want recorded without going through a session. Two equivalent paths:

```sh
ai-knowledge-base node add        # from a shell
```

```
/kb-add                            # from inside a session
```

Both write directly to `nodes/<kind>/<id>.md`. Review with `git diff` and commit.

## Seed from existing docs (one-time bootstrap)

If your repo already has READMEs, ADRs, and module docs, you can seed the KB from them.

From inside a Claude Code session:

```
/kb-bootstrap                      # scans docs/ and root *.md
/kb-bootstrap docs/architecture    # scope to a path
```

The skill surveys your docs, splits them into practice and map nodes, and writes them directly under `nodes/`. Existing nodes are never overwritten — collisions are skipped and reported. Review with `git diff nodes/` and commit the ones you want.

For re-runs after editing docs:

```sh
ai-knowledge-base bootstrap-incremental --from docs/
```

Hash-aware — only reprocesses docs that changed since the last run. Same conservative collision behavior.

## What about CI?

CI's job is to validate that what's committed is well-formed, not to run the LLM pipelines. A reasonable check:

```sh
ai-knowledge-base doctor --verbose
ai-knowledge-base index rebuild
git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
```

The last step catches commits that bypassed the pre-commit hook. Don't run `curate` or `bootstrap-incremental` in CI: they spawn `claude -p` and produce changes to `nodes/` that still need human review.

## Status

To see what's pending at any time:

```sh
ai-knowledge-base status
```

Reports queued captures, pending session logs, unresolved curator conflicts, and node counts.
