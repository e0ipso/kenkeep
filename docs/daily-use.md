---
title: Daily use
nav_order: 4
---

# Daily use

Most days you do nothing. Capture and recall run on their own. When the nudge appears, it is three steps: `/kk-curate`, then `git diff`, then `git commit`.

<p align="center">
  <img src="{{ '/assets/diagrams/review-gate.svg' | relative_url }}" alt="The review gate: /kk-curate writes an uncommitted diff under nodes/, you read it with git diff, then git commit to keep or git restore to drop. Contradictions go to conflicts/ and the skill asks y, n, s, or k for each." />
</p>

## The loop

1. Code with your assistant as usual. Wrap anything in `<kk-private>…</kk-private>` and it never reaches disk.
2. When the nudge appears, run `/kk-curate`.
3. Answer the prompt for each contradiction, if there are any.
4. Read the diff under `.ai/kenkeep/nodes/`. Commit what you want, `git restore <path>` what you don't.
5. After a restore, run `npx kenkeep index rebuild` so the index forgets the dropped notes.

## The nudge

Every session start counts captured sessions still waiting for curation. At `curationThreshold` (default 20) it appends one line to the injected context and sends a desktop notification where one is available, through `osascript` on macOS or `notify-send` on Linux. The nudge gets loud when the queue reaches twice the threshold, or when the oldest capture is a week old. Both the threshold and the notifications are set in [`config.yaml`](installation.md#configuration).

## Skills

`init` installs five skills into your harness. Run them inside a session.

| Skill | What it does |
|---|---|
| `/kk-curate` | Reads pending captures, drafts notes, rebuilds the index, and walks you through contradictions. The daily loop. |
| `/kk-add` | Records one note from the current conversation. Reach for it the moment you make a decision. |
| `/kk-session-extract` | Curates the current session right now, without waiting for capture and a later `/kk-curate`. Covers only what is still visible after compaction. |
| `/kk-bootstrap` | Seeds notes from existing docs. Usually once, at [setup](installation.md#seed-from-existing-docs). |
| `/kk-migrate` | Runs a pending knowledge-base migration when `doctor` asks for one. |

{% include callout.html variant="warning" content="Run one LLM skill at a time per repo. `/kk-curate` and `/kk-bootstrap` take no lock, so two concurrent runs can silently lose each other's bookkeeping. Nothing is corrupted, but some sessions get reprocessed on the next run." %}

## What curate does

For every candidate fact the curator picks one action:

| Action | Effect |
|---|---|
| add | Writes a new note into the best-fitting existing folder, or the `nodes/` root when nothing fits. |
| modify | Rewrites an existing note in place, by id. |
| contradict | Writes `conflicts/<id>.md` and touches no note. |
| drop | Nothing. |

Curation never creates, splits, or merges folders. The last phase, rebalance, does that only when a deterministic size check trips, which most runs do not. The moves are renames (`R` in `git diff --summary`), ids stay stable, and you can `git restore` just the moves and keep the notes.

Each contradiction gets one prompt:

```
Accept this proposal? [Y/n/s/k] (default: Y)
```

| Key | Meaning |
|---|---|
| `y` | Rewrite the existing note with the proposed body. |
| `n` | Reject. The note stays as it was. |
| `s` | Skip. The conflict comes back next run. |
| `k` | Keep the conflict file as a record and commit it. |

## Status and freshness

`npx kenkeep status` prints both queues: captures awaiting extraction, and extracted captures awaiting curation.

`npx kenkeep freshness` lists notes that mention source files which changed since the note was last committed. Add `--verbose` for the file list, then feed it to `/kk-curate`. It reads git history only and always exits 0. On a shallow clone it flags less, never more.

## Housekeeping

`npx kenkeep logs prune` deletes JSONL traces under `_logs/` older than `logsRetentionDays` (default 30).
