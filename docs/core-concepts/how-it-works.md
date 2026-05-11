---
title: How it works
parent: Core Concepts
nav_order: 1
---

# How it works

Three pipelines, independent. Disabling one (by removing its hook entry) doesn't break the others.

## Capture

**Stage 1 (sync, ≤1s).** `kb-capture.mjs` runs on `Stop`, `SessionEnd`, `PreCompact`. Reads the transcript, redacts with gitleaks, writes `_sessions/<id>.md` with `stage_2_status: pending`, appends to `_sessions/.queue.json`. If gitleaks fails or isn't on PATH, capture aborts (security over availability).

**Stage 2 (async, next `SessionStart`).** `kb-stage2-drain.mjs` pops up to 5 queue entries. Per entry: spawns `claude -p` against the redacted transcript with the [stage-2 prompt](../customization/stage-2-prompt.md), validates output against the Zod schema, writes practice and map candidates into the session log frontmatter. Three failures mark the log `skipped`.

## Curate

Explicit. `/kb-curate` or `ai-knowledge-base curate`.

1. Acquires the `curator` lock.
2. Batches every stage-2-done, not-yet-curated log.
3. Spawns `claude -p` per batch with the [curator prompt](../customization/curator-prompt.md). Output is a list of add/modify/contradict/drop actions.
4. Writes proposals to `_proposed/{additions,modifications,contradictions}/`.
5. Stamps each session log with `curator_processed_at`.
6. Regenerates `INDEX.md` and `GRAPH.md` deterministically.

Contradictions always carry `suggested_resolution: null`. The reviewer chooses.

## Consume

Sync, on every `SessionStart`. `kb-session-start.mjs` reads `INDEX.md`, checks freshness via `nodes_hash`, counts pending logs, and emits one JSON line that Claude Code merges as `additionalContext`. The assistant sees the current KB summary as if it were a `CLAUDE.md`.

A curate nudge appears when pending logs cross the threshold (default 5), throttled to once per hour.

## Pipeline diagram

```
Stop / SessionEnd / PreCompact
            │
            ▼
   kb-capture.mjs  (sync)
            │
            ▼
   _sessions/<log>.md  (pending)  →  .queue.json
                                          │
                                  SessionStart
                                          ▼
                              kb-stage2-drain.mjs  (async)
                                          │
                                          ▼
                              _sessions/<log>.md  (done, proposals)
                                          │
                                    /kb-curate
                                          ▼
                              ai-knowledge-base curate
                                          │
                                          ▼
                              _proposed/{additions,modifications,contradictions}/
                                          │
                                proposals review
                                          ▼
                              nodes/<kind>/<slug>.md  →  INDEX.md
                                                              │
                                                       SessionStart
                                                              ▼
                                                  kb-session-start.mjs (sync)
                                                              │
                                                              ▼
                                                  additionalContext  →  assistant
```

## Bootstrap (optional)

Two opt-in pipelines seed the KB from existing markdown. Both share the proposals path with the curator. See [Bootstrap](../bootstrap/).

## What's automatic

| Step | Automatic |
|---|---|
| Stage-1 capture | yes |
| Stage-2 extraction | yes (async) |
| Curate | **no** |
| Proposal review | **no** |
| INDEX/GRAPH regeneration | yes (after curate or node add) |
| Consume injection | yes |
| Bootstrap | **no** |

The cheap deterministic steps run on their own. Judgment-heavy steps stay manual.
