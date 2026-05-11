---
title: First capture and curate
parent: Getting Started
nav_order: 2
---

# First capture and curate

A full pass through the pipeline.

## 1. Have a session

Open Claude Code in the repo and have a conversation that teaches something project-specific. When the session ends, the capture hook writes a redacted session log to `.ai/knowledge-base/_sessions/` and queues it for stage-2.

Verify with `ai-knowledge-base status`.

## 2. Open another session

Stage-2 runs in the background on `SessionStart`. It calls `claude -p` per queued log to extract `practice` and `map` candidates, writes them back into the log frontmatter, and flips `stage_2_status` to `done`.

## 3. Curate

In a session, run `/kb-curate` (or `ai-knowledge-base curate` in a shell). The curator batches pending logs, produces add/modify/contradict proposals under `.ai/knowledge-base/_proposed/`, and regenerates `INDEX.md` and `GRAPH.md`.

Contradictions never auto-resolve. The reviewer picks the resolution.

## 4. Review

```sh
ai-knowledge-base proposals review
```

Accept moves the file into `nodes/<kind>/`. Reject deletes it. For contradictions, pick `supersede`, `keep_both`, or `reject` first.

## 5. Next session

The consume hook injects `INDEX.md` into the new session's context at startup. The assistant now sees the curated knowledge.

## Manual capture

To capture knowledge without waiting for a session:

```sh
ai-knowledge-base node add
# or, in-session:
/kb-add
```

Both write to `_proposed/additions/` with `proposal.rationale: "manual"`.

## Logs

Stage-2 and curator traces live under `.ai/knowledge-base/_logs/`, gitignored by default. See [Troubleshooting](../troubleshooting/) when something looks off.
