---
id: 4
group: "discovery-tree-descent"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-06-05
skills:
  - technical-writing
---
# Update documentation to describe root-only injection and the descent directive

## Objective
Update the project documentation so it matches the new discovery surface: SessionStart injects only the root index node, the static AGENTS.md pointer describes entering at the root index node and descending, and the navigation model is descent (read root, pick branches, descend index nodes, pull only needed leaves, follow cross edges) rather than grep-the-flat-catalog. Update `AGENTS.md`, `docs/how-it-works.md`, and `docs/internals/hooks.md`.

## Skills Required
- `technical-writing`: revise existing prose to describe the new injection and navigation model accurately and consistently across the three documents.

## Acceptance Criteria
- [ ] `AGENTS.md`: the description of the injected pointer and the navigation model reflects root-only injection and descent (enter at the root index node, choose relevant branches, descend, pull only needed leaves, follow `relates_to` / `depends_on` cross edges; multiple branches may be relevant and the agent chooses depth).
- [ ] `docs/how-it-works.md`: states that SessionStart now injects the root index node and the descent directive instead of the full flat catalog.
- [ ] `docs/internals/hooks.md`: the SessionStart section describes injecting the root index node body and the descent directive, and notes the preserved staleness, nudge, and lint surfaces.
- [ ] Any remaining references to "consult INDEX.md", "grep the flat catalog", or grep-based candidate discovery in these three files are removed or rewritten to the descent model.
- [ ] Documentation wording is consistent with the directive text shipped in task 1 and the pointer block shipped in task 2 (no contradictory descriptions).
- [ ] No em dashes in any changed file.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files to modify: `AGENTS.md`, `docs/how-it-works.md`, `docs/internals/hooks.md`.
- Do not modify KB nodes here; per the plan, KB node updates (`map-session-start-hook`, the navigation-directive practice node, `map-index-md`) are left uncommitted for human acceptance and are out of scope for this task.
- Keep documentation factually aligned with the implemented behavior from tasks 1 to 3.

## Input Dependencies
- Task 1: the implemented root-only injection and descent directive whose behavior the docs describe.
- Task 2: the updated static AGENTS.md pointer block whose framing the docs must match.
- Task 3: the per-harness channel behavior (additionalContext, OpenCode file write, Cursor relay) that the hooks doc should describe accurately.

## Output Artifacts
- Updated `AGENTS.md`, `docs/how-it-works.md`, and `docs/internals/hooks.md` describing root-only injection and the descent navigation model.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read the current `AGENTS.md`, `docs/how-it-works.md`, and `docs/internals/hooks.md` and find every passage describing the SessionStart injection, the injected pointer, and the navigation/discovery model (look for "INDEX.md", "catalog", "grep", "navigation directive").
2. In `AGENTS.md`, rewrite the injected-pointer and navigation-model description to the descent framing: enter at the root index node, select one or more relevant branches by intent/tags, read those branch index nodes, descend only as deep as the task needs, open only confirmed-relevant leaves, and follow `relates_to` / `depends_on` cross edges. State that multiple branches can be relevant and the agent chooses depth. Keep it consistent with the task 2 pointer block.
3. In `docs/how-it-works.md`, update the SessionStart description so it says the injected body is the root index node (bounded, independent of KB size) plus the descent directive, replacing any "full catalog" or "grep" description.
4. In `docs/internals/hooks.md`, update the SessionStart hook section: it injects the root index node body and the descent directive; the `nodes_hash` drift/staleness line, the curation-queue nudge, and the lint summary are preserved; and note the per-harness channels (additionalContext for Claude/Codex/Copilot, `.opencode/AGENTS.md` for OpenCode, Cursor relay caveat) as implemented in task 3.
5. Remove or rewrite any leftover grep-the-flat-catalog instructions in these three files so nothing contradicts the descent model.
6. Do not use em dashes in any changed file. Do not edit KB nodes.

</details>
