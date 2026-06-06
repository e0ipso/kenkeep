---
id: 2
group: "discovery-tree-descent"
dependencies: [1]
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 5
complexity_notes: "Touches the static AGENTS.md pointer writer used by both init and upgrade, and must reuse the exact directive text exported by task 1 rather than duplicating wording, so the two discovery surfaces never drift."
---
# Update the static AGENTS.md kk-index pointer block to the descent framing

## Objective
Update the static `kenkeep:kk-index` pointer block that init and upgrade inject into `AGENTS.md` (in `src/commands/init.ts`) so it describes entering the knowledge base at the root index node and descending, instead of "consult INDEX.md". The pointer must reuse the single exported descent directive text from task 1 (`KK_NAVIGATION_DIRECTIVE` or its equivalent name) so the hook surface and the always-on file surface share one source of truth and cannot diverge.

## Skills Required
- `typescript`: edit the pointer-injection logic in `src/commands/init.ts` and import the shared directive constant from `src/lib/session-start.ts`.

## Acceptance Criteria
- [ ] The static `kenkeep:kk-index` pointer block written into `AGENTS.md` describes: enter at the root index node, pick one or more relevant branches, read their branch index nodes, descend only as deep as the task needs, open only confirmed-relevant leaves, and follow `relates_to` / `depends_on` cross edges. It states that multiple branches can be relevant and the agent chooses depth.
- [ ] The pointer text is sourced from the same exported constant produced by task 1; the directive wording is not re-typed or duplicated in `init.ts`.
- [ ] Both the init path and the upgrade path write the updated pointer block (whatever single code path init and upgrade share for the kk-index pointer is updated once).
- [ ] The marker/sentinel that delimits the injected pointer block (so init/upgrade can find and replace it idempotently) is preserved; re-running upgrade still replaces the block cleanly rather than appending a duplicate.
- [ ] No em dashes in any changed file.
- [ ] `npm run typecheck` passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File to modify: `src/commands/init.ts` (the only file that currently references `kk-index`).
- Import the exported directive constant from `src/lib/session-start.ts`; do not inline a second copy of the directive string.
- Keep the existing block markers / sentinels intact so the block remains idempotently replaceable on upgrade.
- Do not change any other init or upgrade behavior. This task only changes the pointer block's wording and its source.

## Input Dependencies
- Task 1: provides the exported descent directive constant (`KK_NAVIGATION_DIRECTIVE` or its final name) that this task imports.

## Output Artifacts
- Updated `src/commands/init.ts` whose kk-index pointer block uses the descent framing sourced from the shared constant.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `src/commands/init.ts` and locate the `kenkeep:kk-index` pointer block: the string literal currently telling the agent to "consult INDEX.md", plus the marker/sentinel lines that wrap it for idempotent replacement on upgrade.
2. Confirm the constant name exported by task 1 from `src/lib/session-start.ts` (recorded by task 1; e.g. `KK_NAVIGATION_DIRECTIVE`). Add an import for it in `init.ts`.
3. Replace the inline "consult INDEX.md" wording with the shared directive constant. If the pointer block needs a short lead-in line (for example a heading or a one-line framing such as "Enter the knowledge base at the root index node and descend:"), keep that lead-in but make the directive body come from the shared constant so the descent wording itself is never duplicated.
4. Verify the marker/sentinel lines that bound the block are unchanged so the upgrade path still finds and replaces exactly this block (no duplicate blocks on re-run). If init and upgrade share one helper to write this block, the single edit covers both; if they have separate code paths, update both to use the shared constant.
5. Do not touch unrelated init/upgrade behavior (skills install, settings, templates).
6. Run `npm run typecheck` and fix only type errors introduced by this change.
7. Do not use em dashes in any changed file.

</details>
