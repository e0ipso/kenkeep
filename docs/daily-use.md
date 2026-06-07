---
title: Daily use
nav_order: 4
---

# Daily use

After install, kenkeep runs itself. Capture and injection happen on their own; the only thing you ever do by hand is **curate**, **review**, and **commit**.

{% include callout.html variant="tip" content="Most days you do nothing. When the nudge appears, it's three steps: `/kk-curate`, then `git diff`, then `git commit` what you want to keep." %}

## The loop

1. Code with your AI assistant as usual.
2. When you see the curate nudge (or whenever you feel like it), run `/kk-curate`.
3. If the curator reports any contradictions, the skill walks you through each one in-session and applies your chosen resolution.
4. Inspect the resulting changes under `.ai/kenkeep/nodes/` with `git diff` (or your preferred diff tool, e.g. [self-review](https://github.com/e0ipso/self-review)).
5. `git commit` what you want to keep; `git restore <path>` to discard.

The pre-commit hook regenerates `INDEX.md` and `GRAPH.md` and stages them into the same commit, so the injected index never drifts from the committed nodes.

That is the entire daily workflow. The rest of this page is reference: the three skills, and the two manual actions you reach for occasionally.

## Skills

Three in-session skills do all the work. Run them inside your harness session; the LLM call happens in that same session, with the model, prompt cache, and tools you already use interactively.

| Skill | What it does | When you reach for it |
|---|---|---|
| `/kk-add` | Conversationally gathers a node's fields, checks `INDEX.md` for overlap, writes it under `nodes/`. | Any time you want to capture a fact on the spot. |
| `/kk-curate` | Reads pending captured sessions, drafts proposed notes under `nodes/`, rebuilds `INDEX.md`/`GRAPH.md`, and walks you through any contradictions with the `y/n/s/k` prompt. | The daily loop, when nudged. |
| `/kk-bootstrap` | Seeds nodes from your existing docs — a one-time setup step, see [Installation → Seed from existing docs](installation.md#seed-from-existing-docs). | Once, at setup. |

{% include callout.html variant="warning" content="Run only one LLM skill at a time per repo. `/kk-curate` and `/kk-bootstrap` are single-author by design and take no cross-process lock, so concurrent runs against the same repo can silently waste work (sessions reprocess on the next run — no data loss). See [Architecture → Locking](internals/architecture.md#locking)." %}

## The curate nudge

You don't have to remember to curate. SessionStart counts pending session logs and, once the queue is worth your attention, appends a one-line nudge to the injected context and prints a visible warning to stderr. It escalates to a loud heading when the queue is large or stale. The thresholds are configurable — see [Internals → Hooks](internals/hooks.md#kk-session-startmjs-consume).

## Curate

In a harness session:

```
/kk-curate
```

The curator reads every captured session that's been processed but not yet curated and applies its decisions directly to `nodes/`:

| Decision | Effect |
|---|---|
| **add** | Writes the new note into its home branch, the best-fitting existing folder under `nodes/` (or the `nodes/` root when nothing fits). The note id is independent of the folder. |
| **modify** | Updates the target note in place at its current path by id, with no relocation. Fails loud if `target_node_id` is missing on disk. |
| **contradict** | Records the conflict under `.ai/kenkeep/conflicts/<id>.md` with `status: pending`; writes nothing to `nodes/`. |
| **drop** | No change. |

The curator names where each new note lives: as it relates a note to its neighbors, the same reasoning pass picks the home branch. Curation places notes into existing folders only and never creates, splits, or merges folders. The end-of-run summary lists the placement decision per written note (the folder it landed in, or `root fallback`) so you can review placement alongside content.

### Rebalance (act-and-fold)

Structural upkeep folds into curate as its last phase; there is no separate command and no extra nudge. A deterministic, LLM-free trigger checks the per-folder metrics with a hysteresis margin. If nothing trips, the phase is skipped and curate ends exactly as before. If a threshold trips, the LLM splits a folder, splits a bloated note, merges a sparse branch, or creates a branch for a novel top-level topic, on the affected branches only.

The structural changes land in the **same** working-tree diff as the note writes (act-and-fold). The only review gate is the one you already use: `git diff` to inspect, then `git commit` to accept everything, or a path-scoped `git restore <path>` to reject just the structural moves while keeping the note writes (or the reverse). Moves preserve content byte-for-byte, so `git diff --summary` shows them as `R` renames rather than churn; ids stay stable so cross references survive. Curate prints a structural summary as a legend for the diff. To undo a whole rebalance, restore the moved paths; to keep it, commit.

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

## Add knowledge manually

`/kk-add` writes a node directly from the current session. Review with `git diff` and commit. Reach for it when you want to capture a decision the moment you make it, without waiting for the next curate pass.

## Status

`npx kenkeep status` reports queued captures, pending logs, unresolved conflicts, and node counts.
