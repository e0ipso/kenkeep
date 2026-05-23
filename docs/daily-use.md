---
title: Daily use
nav_order: 4
---

# Daily use

After install, the only thing you do by hand is **curate**, **review**, and **commit**. Everything else is automatic.

## Skills and CLI

Every workflow has both an in-session **skill** and a **CLI** form. The CLI form is a **launcher**: it execs your active harness against the matching slash-command (`claude -p "/kb-curate"`, `codex …`, etc.). The LLM call happens once, inside the host harness session — the same model, prompt cache, and tools you already use interactively.

- **`/kb-add` ≡ `node add`.** The skill conversationally gathers fields, checks INDEX for overlap, and persists via the `node write` primitive. The CLI launcher execs the same skill.
- **`/kb-curate` ≡ `curate`.** The skill reads pending session logs, drafts curator proposals in-session, hands the merged set to the deterministic `curate-dedup` primitive, then runs `index rebuild`. Inside an interactive session the skill also walks each `contradict` conflict with the `y/n/s/k` prompt; that walkthrough still happens when you invoke via the CLI launcher (since the launcher just opens a host session).
- **`/kb-bootstrap` ≡ `bootstrap`.** The skill enumerates candidate docs via the `finddocs` primitive, reads them with the host's `Read` tool, drafts node bodies inline, and persists via `node write`. Same flow either entry point.

Use the slash-commands when you're already in a harness session (no extra process spawn). Use the launchers from a shell or CI script.

### Parallel drafting and per-batch logs

When the active harness exposes a native sub-agent / task primitive (currently Claude Code and Cursor are confirmed; Codex works at the workflow level; opencode falls back conservatively), `kb-bootstrap` and `kb-curate` fan their drafting work out across up to five host sub-agents per orchestrator wave. Each agent reads its own slice in an isolated context, drafts JSON, and writes a tmpfile that the host collects and persists through the same `node write` / `curate-dedup` primitives as before. On harnesses without a native dispatch primitive, the skills silently fall back to sequential inline drafting — same behaviour you've shipped with since the launcher refactor. `kb-add` uses the same delegation mechanism but only for **context isolation** (a single sub-agent drafts the one node so the host transcript stays clean) — there is no throughput gain there because there is only ever one unit of work.

Each run drops a lowest-common-denominator JSONL trace under `.ai/knowledge-base/_logs/`, with one file per batch (or one per run for `kb-add`):

```
.ai/knowledge-base/_logs/bootstrap/<runId>__<batchN>.jsonl
.ai/knowledge-base/_logs/curator/<runId>__<batchN>.jsonl
.ai/knowledge-base/_logs/kb-add/<runId>.jsonl
```

These are gitignored along with everything else under `_logs/` — they are per-user diagnostic state, not something to commit. Use them to confirm whether the parallel or the inline-fallback path ran on your harness.

**Do not run `kb-bootstrap` and `kb-curate` simultaneously against the same repo.** The two skills touch overlapping state files and there is no cross-skill lock; concurrent invocations may interleave in surprising ways.

### Host-context cost on large doc trees

Because the LLM now runs inside the host harness session, the bootstrap skill reads every candidate doc into **that** session's context window — the cost that used to be paid by ephemeral sub-agents now lands on the user's host session. On a small repo this is invisible; on a monorepo with hundreds of markdown files it may force a host-side compaction mid-run.

Two levers, in order of preference:

1. **Scope with `--from <subdir>`.** `bootstrap --from docs/` (or any other subtree) limits the walk root and dramatically reduces context use.
2. **Tighten `.kbignore`.** Add entries to deny large generated or vendored markdown subtrees that don't carry curated knowledge.

If neither is enough, run `bootstrap` against narrower scopes one at a time.

### No concurrent invocations of `curate` (or `bootstrap`)

Skill sessions are **single-author by design**. There is no cross-process lock on `state.json`, `bootstrap-state.json`, or session-log frontmatter stamps. The atomic tmp+rename writes inside `curate-dedup` and `node write` mean a crash never leaves a partially-written file — but if you run two `curate` launchers from two shells simultaneously, the second writer's state-mark update can silently lose to the first, leaving some sessions unmarked. They'll reprocess on the next run (no data loss), but you've wasted the work.

The rule: **run one `curate` (or `bootstrap`) at a time per repo**. Coordinate by hand if multiple developers are running it on the same workspace.

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

`/kb-bootstrap [path]` in-session, or `npx @e0ipso/ai-knowledge-base bootstrap --from docs/` from a shell — same skill either way. Hash-aware (only reprocesses docs whose SHA-256 changed since the last run). Existing nodes are never overwritten. See [Installation → Seed from existing docs](installation.md#seed-from-existing-docs) for details.

If you have scripts or CI invocations still calling `bootstrap-incremental`, they keep working as a deprecation alias for one release. Update them to `bootstrap` — the alias is removed in the release after next.

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
