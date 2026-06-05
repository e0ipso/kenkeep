---
title: Daily use
nav_order: 4
---

# Daily use

After install, the only thing you do by hand is **curate**, **review**, and **commit**. Everything else is automatic.

## Skills

Three in-session skills do all the work. Run them inside your harness session; the LLM call happens in that same session, with the model, prompt cache, and tools you already use interactively.

- **`/kk-add`** conversationally gathers a node's fields, checks `INDEX.md` for overlap, and writes it under `nodes/`.
- **`/kk-curate`** reads pending captured sessions, drafts proposed notes, writes them under `nodes/`, and rebuilds `INDEX.md` and `GRAPH.md`. It walks you through any contradictions with the `y/n/s/k` prompt.
- **`/kk-bootstrap`** reads your existing docs and drafts nodes from them (see [Seed from existing docs](#seed-from-existing-docs)).

### Parallel drafting and per-batch logs

When your harness exposes native sub-agents (Claude Code and Cursor today), `/kk-bootstrap` and `/kk-curate` fan their drafting out across up to five sub-agents per wave, each reading its own slice in an isolated context. Harnesses without native sub-agents fall back to sequential drafting automatically. `/kk-add` uses a single sub-agent only for context isolation, so the host transcript stays clean.

Each run drops a JSONL trace under `.ai/kenkeep/_logs/`, one file per batch (or one per run for `/kk-add`):

```
.ai/kenkeep/_logs/bootstrap/<runId>__<batchN>.jsonl
.ai/kenkeep/_logs/curator/<runId>__<batchN>.jsonl
.ai/kenkeep/_logs/kk-add/<runId>.jsonl
```

These are gitignored with everything else under `_logs/`: per-user diagnostic state, not something to commit. Use them to confirm whether the parallel or the fallback path ran on your harness.

**Don't run `/kk-bootstrap` and `/kk-curate` at the same time against one repo.** They touch overlapping state and there is no cross-skill lock; concurrent runs may interleave in surprising ways.

### Host-context cost on large doc trees

`/kk-bootstrap` reads every candidate doc into your harness session's context window. On a small repo this is invisible; on a monorepo with hundreds of markdown files it may force a compaction mid-run.

Two levers, in order of preference:

1. **Scope the run.** `/kk-bootstrap docs/` (or any other subtree) limits the walk root and dramatically reduces context use.
2. **Tighten `.kkignore`.** Add entries to deny large generated or vendored markdown subtrees that don't carry curated knowledge.

If neither is enough, run `/kk-bootstrap` against narrower scopes one at a time.

### Don't run two curates (or bootstraps) at once

The skills are **single-author by design**: there is no cross-process lock. If you run two `/kk-curate` passes against the same repo at once, the second writer's state update can silently lose to the first, leaving some sessions unmarked. They reprocess on the next run (no data loss), but the work is wasted. Run one `/kk-curate` (or `/kk-bootstrap`) at a time per repo, and coordinate by hand if several developers share a workspace.

## The loop

1. Code with Claude Code as usual.
2. When you see the curate nudge (or whenever you feel like it), run `/kk-curate`.
3. If the curator reports any contradictions, the skill walks you through each one in-session and applies your chosen resolution.
4. Inspect the resulting changes under `.ai/kenkeep/nodes/` with `git diff` (or your preferred diff tool, e.g. [self-review](https://github.com/e0ipso/self-review)).
5. `git commit` what you want to keep; `git restore <path>` to discard.

The pre-commit hook regenerates `INDEX.md` and `GRAPH.md` and stages them into the same commit, so the injected index never drifts from the committed nodes.

## The SessionStart nudge

SessionStart counts pending session logs and, once the queue is worth your attention, appends a one-line nudge to the injected context and prints a visible warning to stderr. It escalates to a loud `🚨 kenkeep curation queue is overdue` heading when the queue is large or stale (defaults: `threshold=5`, `staleDays=7`; loud fires at `pending >= 10` or `pending >= 5 && oldest >= 7d`).

## Curate

{% capture curate_cost_tip %}
Curation is a structured classification task: the prompts are explicit decision trees with inline examples, and the pipeline includes human review via `git commit`/`git restore` as a safety net. A mid-tier model at moderate effort is sufficient; higher-tier models produce marginally better output at significantly higher cost without meaningful quality improvement for this workload. Example configurations: Claude `sonnet` / `medium` effort, Codex `gpt-5-codex` / `low` reasoning effort.
{% endcapture %}
{% include callout.html variant="tip" title="Model cost tip" content=curate_cost_tip %}

In a harness session:

```
/kk-curate
```

The curator reads every captured session that's been processed but not yet curated and applies its decisions directly to `nodes/`:

- **add** → writes `nodes/<kind>/<id>.md`. Fails loud if the file already exists.
- **modify** → overwrites the target node. Fails loud if `target_node_id` is missing on disk.
- **contradict** → records the conflict as a markdown file under `.ai/kenkeep/conflicts/<id>.md` with `status: pending` and writes nothing to `nodes/`.
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
| `y` | Accept: rewrite the node with the proposed body, then `git restore` the conflict file. |
| `n` | Reject: `git restore` the conflict file; node unchanged. |
| `s` | Skip: leave the conflict file pending; it re-surfaces next pass. |
| `k` | Keep: `git commit` the conflict file as a historical record; node unchanged. |

Defaults are heuristic per conflict (small diffs default `y`, rewrites `n`, otherwise `s`). Long forms (`yes`, `skip`) and uppercase work; anything else is re-prompted.

## Review changes

Review with `git diff nodes/`. Accept with `git commit` (the pre-commit hook regenerates and stages `INDEX.md`/`GRAPH.md`). Reject with `git restore <path>`. For curator contradictions, let `/kk-curate` walk you through the `y/n/s/k` prompt.

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.5rem;" markdown="1">
<div markdown="1">

## Add knowledge manually

`/kk-add` writes a node directly from the current session. Review with `git diff` and commit.

</div>
<div markdown="1">

## Seed from existing docs

{% capture bootstrap_cost_tip %}
Bootstrap is cognitively simpler than curation: its input is structured documentation (not messy session transcripts), there is no session-disposition gate, and no conflict detection. The same mid-tier model recommendation applies, and arguably with even more room to go lower. Example configurations: Claude `sonnet` / `medium` effort, Codex `gpt-5-codex` / `low` reasoning effort.
{% endcapture %}
{% include callout.html variant="tip" title="Model cost tip" content=bootstrap_cost_tip %}

`/kk-bootstrap [path]` in a harness session. Hash-aware (only reprocesses docs whose SHA-256 changed since the last run). Existing nodes are never overwritten. See [Installation → Seed from existing docs](installation.md#seed-from-existing-docs) for details.

</div>
</div>

## CI

Validate what's committed; don't run the LLM pipelines:

```sh
npx kenkeep doctor --verbose
npx kenkeep index rebuild
git diff --exit-code .ai/kenkeep/INDEX.md .ai/kenkeep/GRAPH.md
```

The last line catches commits that bypassed the pre-commit hook.

## Status

`npx kenkeep status` reports queued captures, pending logs, unresolved conflicts, and node counts.
