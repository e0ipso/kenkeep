---
title: How it works
parent: Core Concepts
nav_order: 1
---

# How it works

Three pipelines connect Claude Code session activity to a curated knowledge base committed in your repo. Each pipeline is independent — you can disable any one of them (by removing its hook entry) without breaking the others.

## 1. Capture — turn transcripts into candidates

Trigger: every time Claude Code fires `Stop`, `SessionEnd`, or `PreCompact`. Two stages.

**Stage 1 (sync, ≤1 s deadline).** The `kb-capture.mjs` hook reads the transcript path from the hook input, parses out the user/assistant text, runs gitleaks redaction over it, and writes `_sessions/<YYYYMMDD-HHmm-id>.md` with `stage_2_status: pending`. The session log path is appended to `_sessions/.queue.json`. If gitleaks isn't available or crashes, capture aborts — the security guarantee outweighs availability.

**Stage 2 (async, on next `SessionStart`).** The `kb-stage2-drain.mjs` hook pops up to 5 entries off the queue. For each, it spawns `claude -p` against the redacted transcript with the [stage-2 prompt](../customization/stage-2-prompt.md), streams the JSON output to `_logs/stage-2/<id>__<ts>.jsonl`, parses the final result, validates it against the Zod schema, and writes the structured `practice` and `map` candidates back into the session log's frontmatter. Failures retry (max 3 attempts) and then mark the log `stage_2_status: skipped`.

End state: every successfully-processed session log carries `stage_2_status: done` plus arrays of candidate nodes in its frontmatter. Nothing has been written to `nodes/` yet — the assistant has no visibility of these candidates until they're curated.

## 2. Curate — turn candidates into proposals

Trigger: explicit. Either `/kb-curate` (Claude Code skill) or `ai-knowledge-base curate` (CLI). The consume hook nudges the contributor when ≥ 5 session logs are pending, throttled to once per hour, but the contributor runs the curator deliberately.

`ai-knowledge-base curate`:

1. Acquires the `curator` lock on `state.json`.
2. Batches every stage-2-`done`, not-yet-curated session log by count (default 10) and approximate token budget (default 50K).
3. Spawns one `claude -p` per batch with the [curator prompt](../customization/curator-prompt.md). The curator output is a list of `add` / `modify` / `contradict` / `drop` actions, each carrying a proposed node.
4. Writes one proposal file per non-drop action into `_proposed/{additions,modifications,contradictions}/`. Contradictions always carry `suggested_resolution: null` — the curator never auto-resolves.
5. Stamps each session log with `curator_processed_at` and `curator_run_id` so it isn't re-curated.
6. Regenerates `INDEX.md` and `GRAPH.md` from the current `nodes/` (deterministic, no LLM — see [`src/lib/index-gen.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/index-gen.ts)).

End state: proposals are on disk awaiting review. `ai-knowledge-base proposals review` walks the reviewer through each one. Accepted proposals lose their `proposal` frontmatter block and move into `nodes/<kind>/`. Rejected proposals are deleted.

## 3. Consume — inject the KB at session start

Trigger: every `SessionStart` event from Claude Code. Synchronous.

The `kb-session-start.mjs` hook reads the current `INDEX.md`, detects staleness (by comparing the frontmatter `nodes_hash` against the live hash of `nodes/`), counts pending session logs, and emits a single JSON line on stdout that Claude Code merges into the session's context:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<INDEX body + optional warnings + optional nudge>"
  }
}
```

When the assistant turns on, it already has the current knowledge base summary in its context. There is no MCP, no extra tool calls — the index is just there, like a `CLAUDE.md` file.

End state: knowledge that was captured (and curated, and reviewed) is back in front of the assistant for the next conversation.

## How the pieces hand off

```
                Stop / SessionEnd / PreCompact
                            │
                            ▼
                  kb-capture.mjs (sync)
                            │
                            ▼
                   _sessions/<log>.md
                   stage_2_status: pending
                            │
                            ▼
                       .queue.json
                            │
                            │   SessionStart
                            ▼
              kb-stage2-drain.mjs (async)
                            │
                            ▼
                   _sessions/<log>.md
                   stage_2_status: done
                   proposals: { practice, map }
                            │
                            │   /kb-curate
                            ▼
                ai-knowledge-base curate
                            │
                            ▼
              _proposed/{additions,modifications,contradictions}/
                            │
                            │   ai-knowledge-base proposals review
                            ▼
                      nodes/<kind>/<slug>.md
                            │
                            ▼
                        INDEX.md  (regen)
                            │
                            │   SessionStart
                            ▼
              kb-session-start.mjs (sync)
                            │
                            ▼
                   additionalContext  →  assistant
```

## Bootstrap pipelines

There are two **optional** pipelines that seed the KB from existing markdown documentation. They share the same proposal output path as the curator:

- `/kb-bootstrap` — agent-driven, in-session, for the first time you adopt the KB on a project with existing docs.
- `ai-knowledge-base bootstrap-incremental --from <path>` — deterministic, hash-aware CLI for re-runs after docs change.

See [Bootstrap](../bootstrap/) for both walkthroughs.

## What is and isn't automatic

| Step | Automatic? |
|---|---|
| Stage-1 capture (Stop/SessionEnd/PreCompact) | Yes. Hooks fire automatically; gitleaks redacts; logs are written. |
| Stage-2 extraction | Yes. Runs on next SessionStart in the background. |
| Curate (stage-2 candidates → proposals) | **No.** You run `/kb-curate` or the CLI deliberately. The nudge is a notification, not a trigger. |
| Proposal review | **No.** You step through proposals interactively. |
| INDEX/GRAPH regeneration | Yes, every time the curator runs (or `node add` finishes). |
| Consume injection | Yes. The sync `SessionStart` hook injects INDEX on every session. |
| Bootstrap (`/kb-bootstrap` or `bootstrap-incremental`) | **No.** Opt-in. |

This split is deliberate. The expensive, judgment-heavy steps (curating, reviewing, bootstrapping) stay manual; the deterministic, cheap steps run on their own.
