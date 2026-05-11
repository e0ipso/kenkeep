---
name: kb-curate
description: Curate pending session logs into reviewable knowledge-base proposals (additions, modifications, contradictions) by running the `ai-knowledge-base curate` CLI. Use when the user wants to process accumulated session captures into proposals for review, or when the SessionStart nudge reports pending session logs.
allowed-tools: Bash(ai-knowledge-base curate:*)
---

# kb-curate

Run the curator over pending session logs and turn them into reviewable proposals.

## What to do

1. Run `ai-knowledge-base curate` in the project root. The command:
   - Acquires the curator lock (`.ai/knowledge-base/.state/state.json`, name=`curator`, PID + 30-min TTL).
   - Batches every session log whose `stage_2_status: done` and which has not yet been curated.
   - Spawns `claude -p` per batch with the curator prompt (no recursion: `KB_BUILDER_INTERNAL=1`).
   - Writes proposals under `.ai/knowledge-base/_proposed/{additions,modifications,contradictions}/`.
   - Regenerates `INDEX.md` and `GRAPH.md` from the current `nodes/` tree.

2. Once it finishes, report the summary line to the user (proposals written, drops, batches, run id).

3. Tell the user the next step is `ai-knowledge-base proposals review` to accept or reject the new proposals.

## Constraints

- Do not modify `nodes/` directly. Only the human reviewer promotes proposals into the `nodes/` tree.
- If the command reports `locked`, do not retry — explain that another curate run is in progress.
- If no session logs are pending, the command still regenerates INDEX/GRAPH; that's expected, not an error.
