---
id: 4
group: "docs"
dependencies: [1, 2]
status: "completed"
created: 2026-06-11
skills:
  - technical-writing
---
# Update kenkeep Nodes for Corrected Capture Behavior

## Objective
Update the kenkeep knowledge-base nodes that describe Copilot capture and
`captured_by` semantics so they reflect the corrected behavior delivered by
Tasks 1 and 2 (adapter-owned trigger mapping; real-schema Copilot parser). This
is the documentation deliverable the plan's Documentation section requires.

## Skills Required
- **technical-writing** — accurately revise knowledge-base node prose to match
  the shipped code behavior.

## Acceptance Criteria
- [ ] `.ai/kenkeep/nodes/hooks/map-capture-hook.md` and
      `.ai/kenkeep/nodes/state/map-session-log.md` describe `captured_by` as
      derived per-adapter from native lifecycle events (Copilot
      `sessionEnd`→`session_end`, `agentStop`→`stop`; Cursor `preCompact`→
      `pre_compact`; Codex `Stop`→`stop`; Claude unchanged) — not via a shared
      Claude-keyed map.
- [ ] `.ai/kenkeep/nodes/harnesses/map-copilot-harness-adapter.md` describes the
      real Copilot `events.jsonl` schema (`user.message`/`assistant.message`,
      text at `data.content`, no `data.role`) and that capture produces a
      non-empty role-tagged transcript.
- [ ] `.ai/kenkeep/nodes/harnesses/index.md` is updated where it summarizes
      Copilot capture or `captured_by`, if it states anything now corrected.
- [ ] No node still claims Copilot capture keys on `userMessage`/`agentMessage`/
      `data.role`, or that `captured_by` comes from a Claude-keyed
      `HOOK_EVENT_TO_TRIGGER`.
- [ ] Any `relates_to`/`depends_on` cross-edges and frontmatter remain valid;
      node schema (`schema_version`) is unchanged.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Markdown knowledge-base nodes under `.ai/kenkeep/nodes/`. Verified nodes that
  reference Copilot capture or `captured_by`:
  - `.ai/kenkeep/nodes/state/map-session-log.md`
  - `.ai/kenkeep/nodes/hooks/map-capture-hook.md`
  - `.ai/kenkeep/nodes/harnesses/map-copilot-harness-adapter.md`
  - `.ai/kenkeep/nodes/harnesses/index.md`
- The corrected behavior is defined by the as-merged Task 1 and Task 2 code —
  read those files (`src/lib/capture.ts`, the per-adapter `hooks/kk-capture.ts`,
  `src/harnesses/copilot/transcript.ts`) before editing so the nodes match what
  actually shipped, not what the plan predicted.

## Input Dependencies
- **Task 1** — the adapter-owned `captured_by` trigger mapping (so the
  `captured_by` documentation reflects the relocated mapping).
- **Task 2** — the Copilot parser rewrite (so the Copilot capture documentation
  reflects the real schema).

## Output Artifacts
- Updated kenkeep nodes describing the corrected `captured_by` derivation and
  Copilot capture schema.

## Implementation Notes

> kenkeep nodes are snapshots in time. Before changing a node that names a file
> path, function, or flag, verify it still exists in the merged tree — Tasks 1
> and 2 will have moved/renamed some symbols (e.g. `HOOK_EVENT_TO_TRIGGER` is
> removed). Describe the behavior that shipped, citing live paths.

<details>
<summary>Executable guidance</summary>

1. Wait until Tasks 1 and 2 are merged, then read the actual shipped code:
   `src/lib/capture.ts` (no more `HOOK_EVENT_TO_TRIGGER`; canonical trigger on
   `HookInput`), each `src/harnesses/<h>/hooks/kk-capture.ts` (per-adapter
   native→canonical map), and `src/harnesses/copilot/transcript.ts` (real
   `user.message`/`assistant.message` schema).
2. `hooks/map-capture-hook.md`: revise any statement that `captured_by` is
   derived from a shared Claude-keyed event map; state that each adapter maps its
   native lifecycle events to the canonical `CaptureTrigger`
   (`stop`/`session_end`/`pre_compact`/`manual`).
3. `state/map-session-log.md`: ensure the `captured_by` field description lists
   the per-harness native→canonical examples and notes Claude's values are
   unchanged.
4. `harnesses/map-copilot-harness-adapter.md`: replace any
   `userMessage`/`agentMessage`/`data.role` description with the real schema
   (envelope `{type,data,id,timestamp,parentId}`; `user.message`/
   `assistant.message`; text at `data.content`); note capture now yields a
   non-empty transcript and reference the measured CLI version (v1.0.61).
5. `harnesses/index.md`: update only the Copilot/`captured_by` summary lines if
   they assert anything now corrected; leave unrelated content alone.
6. Keep edits minimal and factual; do not add new nodes (out of scope). Preserve
   frontmatter and cross-edges. Confirm with
   `grep -rniE "userMessage|agentMessage|HOOK_EVENT_TO_TRIGGER" .ai/kenkeep/nodes`
   that no stale references remain in the touched nodes.
</details>
