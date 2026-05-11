---
title: First capture → curate
parent: Getting Started
nav_order: 2
---

# First capture → curate

A walkthrough of one full cycle through the pipeline: capture → drain → curate → review → consume.

## 1. Run a Claude Code session that teaches something

After `ai-knowledge-base init --assistants claude`, open a Claude Code session in the repo and have an exchange where you correct the agent or introduce project-specific context — for example, "no, in this project we use the X service, not Y." End the session normally (`Stop`, `SessionEnd`, or by triggering `PreCompact`).

Under the hood, the capture hook synchronously:

- Dedupes by transcript SHA-256 (5-minute window).
- Runs gitleaks redaction on the transcript slice.
- Writes a session log to `.ai/knowledge-base/_sessions/<timestamp>-<slug>.md` with `stage_2_status: pending`.
- Appends a queue entry to `_sessions/.queue.json`.

You can verify it produced something with `ai-knowledge-base status`.

## 2. Start another session — the stage-2 drain runs in the background

The next time you open a Claude Code session, the async `kb-stage2-drain` hook fires. It spawns `claude -p` per queue entry, extracts practice and map candidates from each transcript, and writes them into the session log frontmatter as `proposals.{practice,map}`. The session log's `stage_2_status` flips to `done`. Status reflects this immediately.

## 3. Run `/kb-curate`

In any session, type `/kb-curate`. The skill body delegates to:

```sh
ai-knowledge-base curate
```

The curator:

- Acquires the `.ai/.kb-builder/state.json` lock (`name: curator`, 30-min TTL).
- Batches every `stage_2_status: done` session log that has not been curated yet.
- Spawns `claude -p` per batch with the curator prompt.
- Writes proposals into `.ai/knowledge-base/_proposed/{additions,modifications,contradictions}/`.
- Regenerates `INDEX.md` and `GRAPH.md` from the current `nodes/` tree.

Contradiction proposals always carry `suggested_resolution: null` — the curator never auto-resolves.

## 4. Review the proposals

```sh
ai-knowledge-base proposals review
```

For each proposal:

- **Addition / modification:** accept (move into `nodes/<kind>/`), reject (delete), or skip.
- **Contradiction:** pick a resolution first (`supersede`, `keep_both`, `reject`), then accept or skip. Choosing `supersede` updates the target node with `valid_until` and `superseded_by` automatically.

The reviewer's commit then carries both the new node files and the regenerated `INDEX.md` / `GRAPH.md`.

## 5. The next session sees the new knowledge

On the next `SessionStart`, the consume hook (M4) reads `INDEX.md` and injects it into the session context. The agent now knows about the practice or map node you just added.

## Capturing knowledge manually

If you notice missing knowledge between sessions, capture it directly without waiting for a session that happens to teach it. Two equivalent paths:

```sh
ai-knowledge-base node add
```

…or, in a session:

```
/kb-add
```

Both land in `_proposed/additions/<kind>-<slug>.md` with `proposal.rationale: "manual"`, so they show up alongside curator-produced proposals during `proposals review`.

## Where the logs go

Stage-2 traces: `.ai/knowledge-base/_logs/stage-2/<session-id>__<timestamp>.jsonl`.
Curator traces: `.ai/knowledge-base/_logs/curator/<run-id>__<timestamp>.jsonl`.

Both directories are gitignored by default. See [Troubleshooting](../troubleshooting/) for how to read them when something goes wrong.
