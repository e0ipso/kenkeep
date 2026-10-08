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

Every session start counts captured sessions still waiting for curation. At `curationThreshold` (default 20) it appends one line to the injected context and sends a desktop notification where one is available, through `osascript` on macOS or `notify-send` on Linux. The nudge fires at most once an hour. A start inside that hour still shows the queue count, without the notification or the prompt to curate. The nudge gets loud when the queue reaches twice the threshold, or when the oldest capture is a week old. A session you already curated counts again if it kept going afterwards. Both the threshold and the notifications are set in [`config.yaml`](installation.md#configuration).

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
| contradict | Writes `conflicts/<id>.md`, with the full proposal when there is one, and touches no note. |
| drop | Nothing. |

A contradiction never hides another action. If a modify and a contradiction target the same note, the modify becomes a second conflict for you to decide, and nothing is applied silently. If one write fails, the others still land and the skill reports the failure. Fix the cause and rerun the same `curate-persist` command. It skips every note that already landed with the same content, so nothing is written twice.

Curation never creates, splits, or merges folders. The last phase, rebalance, does that only when a deterministic size check trips, which most runs do not. The moves are renames (`R` in `git diff --summary`), ids stay stable, and you can `git restore` just the moves and keep the notes.

Open conflicts are reviewed on every run, including ones you skipped earlier and runs with no pending sessions. Each one gets one prompt, with a computed default capitalized:

```
Accept this proposal? [y/N/s/k] (default: reject)
```

| Key | Meaning |
|---|---|
| `y` | Rewrite the existing note in place with the proposal: same id, same path, new title, description, tags, and edges. |
| `n` | Reject. The note stays as it was. |
| `s` | Skip. The conflict stays open and comes back next run. |
| `k` | Keep the conflict file as a record and commit it. The note stays as it was. |

An empty reply applies the displayed default. The default is accept when fewer than 5 lines change and the proposal is high confidence, reject when more than half the lines change, and skip otherwise. It is always skip when the target note is gone or the conflict has no proposal. The skill applies your answer with `npx kenkeep conflict resolve`, which marks the file `accepted`, `rejected`, `kept`, or `skipped` and never deletes it. Decided files stay under `conflicts/` until you commit or delete them.

A conflict file from an older kenkeep lacks the full proposal, so `conflict prepare` and `conflict resolve` refuse it with instructions. Apply it by hand from its `## Proposed node` section, run `npx kenkeep index rebuild`, then delete the file or set `status: kept`.

## Status and freshness

`npx kenkeep status` prints both queues: captures awaiting extraction, and extracted captures awaiting curation.

`npx kenkeep freshness` lists notes that mention source files which changed, were renamed, or were deleted since the note was last committed. Add `--verbose` for the file list, then feed it to `/kk-curate`. It reads git history only and always exits 0. When git cannot answer, it prints `no signal` with the failing `git log` error instead of reporting that everything is fresh. A shallow clone lacks the commits that date each note, so it reports every note fresh. Run `git fetch --unshallow` first.

## Housekeeping

`npx kenkeep logs prune` deletes JSONL traces under `_logs/` older than `logsRetentionDays` (default 30).

`npx kenkeep lint` warns when a note's generated Related or Citations links no longer match the tree, which happens after a hand move. `npx kenkeep node refresh-links` rewrites those sections and rebuilds the indexes. Review the result with `git diff`.

Links inside a note are relative to the note's own file, so they open on GitHub and in any markdown viewer.
