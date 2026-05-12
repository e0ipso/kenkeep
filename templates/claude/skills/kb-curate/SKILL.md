---
name: kb-curate
description: Curate pending session logs into knowledge-base nodes by running the `ai-knowledge-base curate` CLI, then resolve any contradictions surfaced by the curator with the user in-session. Use when the user wants to process accumulated session captures, or when the SessionStart nudge reports pending session logs.
allowed-tools: Bash(ai-knowledge-base curate:*), Read, Edit, Write
---

# kb-curate

Run the curator over pending session logs and apply its decisions directly to `nodes/`, then resolve any contradictions interactively with the user.

## What to do

### 1. Run the curator

Run `ai-knowledge-base curate` in the project root. The command:

- Acquires the curator lock (`.ai/knowledge-base/.state/state.json`, name=`curator`, PID + 30-min TTL).
- Batches every session log whose `stage_2_status: done` and which has not yet been curated.
- Spawns `claude -p` per batch with the curator prompt (no recursion: `KB_BUILDER_INTERNAL=1`).
- Writes node files directly to `.ai/knowledge-base/nodes/<kind>/` for `add` and `modify` actions.
- Records each `contradict` action in `.ai/knowledge-base/.state/pending-conflicts.json` **without writing the conflicting node to disk**.
- Regenerates `INDEX.md` and `GRAPH.md` from the resulting `nodes/` tree.

### 2. Report the summary

Tell the user the curator's headline numbers (nodes written, drops, batches, run id). If the command reported any failures (`add_collision` or `modify_missing_target`), surface those clearly - the user may need to clean up the offending candidate manually.

### 3. Resolve pending conflicts

Read `.ai/knowledge-base/.state/pending-conflicts.json`. For every entry in `conflicts`:

1. Read the existing node referenced by `target_node_id` (under `nodes/<kind>/<target_node_id>.md`).
2. Present both sides to the user concisely:
   - **Existing node** - title, summary, the relevant body excerpt.
   - **Proposed contradiction** - `proposed_node.title`, `summary`, `body`, plus the curator's `rationale`.
3. Ask the user to choose one of:
   - **Supersede** - overwrite the existing node with the proposed content. Set the new node's `supersedes` field to the old id and refresh `valid_from`/`updated`. Use `Edit` or `Write`.
   - **Keep both** - write the proposed content as a new node (different `id`) with `relates_to: [<old-id>]`. Use `Write`.
   - **Reject** - do nothing on disk; the conflict is dismissed.
4. Once the user has decided and you've applied (or skipped) the change, **remove the entry from `pending-conflicts.json`**. Use `Edit` to delete just that one entry; never overwrite the whole file with a stale snapshot.

If the user defers a conflict ("I'll think about it"), leave the entry in place. `ai-knowledge-base status` reports the count, so it won't be forgotten.

### 4. Hand off

Tell the user to review the changed nodes with `git diff nodes/` and commit when they're satisfied. The lint-staged pre-commit hook will regenerate `INDEX.md`/`GRAPH.md` and stage them into the same commit.

## Constraints

- The curator wrapper writes directly to `nodes/`. **You** only modify `nodes/` while resolving contradictions, and only with the user's explicit decision per conflict.
- If `ai-knowledge-base curate` reports `locked`, do not retry - explain that another curate run is in progress.
- If no session logs are pending, the command still regenerates INDEX/GRAPH; that's expected, not an error.
- If `pending-conflicts.json` is missing or has `conflicts: []`, there's nothing to resolve - skip step 3.
