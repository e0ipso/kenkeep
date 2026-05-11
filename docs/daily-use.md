---
title: Daily use
nav_order: 4
---

# Daily use

After install, the only thing you do by hand is **curate** and **review**. Everything else is automatic.

## The loop

1. Code with Claude Code as usual.
2. When you see the curate nudge (or whenever you feel like it), run `/kb-curate`.
3. Review the resulting changes under `.ai/knowledge-base/` (any diff tool — e.g. `git diff` or [self-review](https://github.com/e0ipso/self-review)) and promote the proposals you want to keep into `nodes/`.
4. Commit `.ai/knowledge-base/`.

## Curate

In a Claude Code session:

```
/kb-curate
```

Or from a shell:

```sh
ai-knowledge-base curate
```

The curator looks at every captured session that's been processed but not yet curated, and writes proposals into `.ai/knowledge-base/_proposed/`. Contradictions are never auto-resolved — you'll choose.

## Review proposals

Proposals are plain markdown files under `.ai/knowledge-base/_proposed/{additions,modifications,contradictions}/`. They are important — they may affect how the agent behaves in every future session.

Walk the diff with whatever tool you like — `git diff`, your editor, or a dedicated reviewer such as [self-review](https://github.com/e0ipso/self-review). To accept a proposal, strip its `proposal:` frontmatter block and move the file into `nodes/<kind>/`. To reject, delete the file. For contradictions, set `proposal.suggested_resolution` to `supersede`, `keep_both`, or `reject` before promoting.

After acceptance, run `ai-knowledge-base index rebuild` to refresh `INDEX.md` and `GRAPH.md` before committing.

## Add knowledge manually

Sometimes you know exactly what you want recorded without going through a session. Two equivalent paths:

```sh
ai-knowledge-base node add        # from a shell
```

```
/kb-add                            # from inside a session
```

Both write to `_proposed/additions/`. Review and accept like any other proposal.

## Seed from existing docs (one-time bootstrap)

If your repo already has READMEs, ADRs, and module docs, you can seed the KB from them.

From inside a Claude Code session:

```
/kb-bootstrap                      # scans docs/ and root *.md
/kb-bootstrap docs/architecture    # scope to a path
```

The skill surveys your docs, splits them into practice and map proposals, and writes them to `_proposed/additions/`. Review them like any other proposals.

For re-runs after editing docs:

```sh
ai-knowledge-base bootstrap-incremental --from docs/
```

This is hash-aware — it only reprocesses docs that changed since the last run.

## What about CI?

CI's job is to validate that what's committed is well-formed, not to run the LLM pipelines. A reasonable check:

```sh
ai-knowledge-base doctor --verbose
ai-knowledge-base index rebuild
git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
```

The last step catches hand-edits to `nodes/` that bypassed the curator. Don't run `curate` or `bootstrap-incremental` in CI: they spawn `claude -p` and produce proposals that still need human review.

## Status

To see what's pending at any time:

```sh
ai-knowledge-base status
```
