---
title: Daily use
nav_order: 4
---

# Daily use

After install, the only thing you do by hand is **curate**, **review**, and **commit**. Everything else is automatic.

## Skills and CLI

Every workflow has both an in-session **skill** and a **CLI** form. **Prefer the skills** — they do strictly more than the bare CLI:

- **`/kb-add` ≈ `node add`.** The skill is a conversational wrapper that gathers fields, checks INDEX for overlap, pushes back on bad candidates, then invokes the CLI. Same write either way.
- **`/kb-curate` ⊃ `curate`.** The CLI runs the curator and writes `add`/`modify` to `nodes/`, but `contradict` actions land as pending files under `conflicts/` and *stop there*. **The skill is what walks each conflict with the `y/n/s/k` prompt and applies your choice.** Run the bare CLI from a script and you'll have to resolve conflicts by hand.
- **`/kb-bootstrap` ≠ `bootstrap-incremental`.** These are different mechanisms with the same goal. The skill is agent-driven, supervised, sampling. The CLI is headless, hash-aware, exhaustive (spawns its own `claude -p`). Use the skill for the first pass; use the CLI for incremental re-runs after editing docs.

The CLI forms exist for CI, scripts, plain-shell use, and headless re-runs. The rest of this page leads with the skill form and notes when the CLI differs.

## The loop

1. Code with Claude Code as usual.
2. When you see the curate nudge (or whenever you feel like it), run `/kb-curate`.
3. If the curator reports any contradictions, the skill walks you through each one in-session and applies your chosen resolution.
4. Inspect the resulting changes under `.ai/knowledge-base/nodes/` with `git diff` (or your preferred diff tool, e.g. [self-review](https://github.com/e0ipso/self-review)).
5. `git commit` what you want to keep; `git restore <path>` to discard.

The pre-commit hook regenerates `INDEX.md` and `GRAPH.md` and stages them into the same commit, so the injected index never drifts from the committed nodes.

## The SessionStart nudge

SessionStart counts pending session logs and, once the queue is worth your attention, appends a one-line nudge to the injected context. It throttles to one nudge per hour and escalates to a loud `🔔 KB curation queue is overdue` heading when the queue is large or stale (defaults: `threshold=5`, `staleDays=7`; loud fires at `pending >= 10` or `pending >= 5 && oldest >= 7d`).

## Curate

In a Claude Code session:

```
/kb-curate
```

Or from a shell:

```sh
npx @e0ipso/ai-knowledge-base curate
```

The curator reads every captured session that's been processed but not yet curated and applies its decisions directly to `nodes/`:

- **add** → writes `nodes/<kind>/<id>.md`. Fails loud if the file already exists.
- **modify** → overwrites the target node. Fails loud if `target_node_id` is missing on disk.
- **contradict** → records the conflict as a markdown file under `.ai/knowledge-base/conflicts/<id>.md` with `status: pending` and writes nothing to `nodes/`.
- **drop** → no change.

### Fast path

Zero conflicts and zero failures → the skill prints one summary line and exits. Once a project stabilizes, this is the common case.

### Conflict walkthrough

When the curator reports contradictions, the skill walks each one with the existing node shown side-by-side and a single-character prompt:

```
Accept this proposal? [Y/n/s/k] (default: Y)
```

| Key | Action |
|---|---|
| `y` | Accept — rewrite the node with the proposed body, then `git restore` the conflict file. |
| `n` | Reject — `git restore` the conflict file; node unchanged. |
| `s` | Skip — leave the conflict file pending; it re-surfaces next pass. |
| `k` | Keep — `git commit` the conflict file as a historical record; node unchanged. |

Defaults are heuristic per conflict (small diffs default `y`, rewrites `n`, otherwise `s`). Long forms (`yes`, `skip`) and uppercase work; anything else is re-prompted.

## Review changes

Review with `git diff nodes/`. Accept with `git commit` (the pre-commit hook regenerates and stages `INDEX.md`/`GRAPH.md`). Reject with `git restore <path>`. For curator contradictions, let `/kb-curate` walk you through the `y/n/s/k` prompt.

## Add knowledge manually

`/kb-add` (in-session) or `npx @e0ipso/ai-knowledge-base node add` (shell) writes a node directly. Review with `git diff` and commit.

## Seed from existing docs

`/kb-bootstrap [path]` in-session (supervised) or `npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/` headless (hash-aware, only reprocesses changed docs). Existing nodes are never overwritten. See [Installation → Seed from existing docs](installation.md#seed-from-existing-docs) for details.

## CI

Validate what's committed; don't run the LLM pipelines:

```sh
npx @e0ipso/ai-knowledge-base doctor --verbose
npx @e0ipso/ai-knowledge-base index rebuild
git diff --exit-code .ai/knowledge-base/INDEX.md .ai/knowledge-base/GRAPH.md
```

The last line catches commits that bypassed the pre-commit hook.

## Status

`npx @e0ipso/ai-knowledge-base status` reports queued captures, pending logs, unresolved conflicts, and node counts.
