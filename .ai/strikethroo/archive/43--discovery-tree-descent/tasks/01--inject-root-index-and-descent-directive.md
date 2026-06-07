---
id: 1
group: "discovery-tree-descent"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 6
complexity_notes: "Core behavioral change in buildSessionStartContext: swap the injected body from the flat INDEX.md catalog to the root index.md, rewrite the navigation directive, and expose the directive text as a single shared export while preserving drift, nudge, and lint logic exactly."
---
# Inject only the root index node and rewrite the navigation directive to descent

## Objective
Change `buildSessionStartContext` in `src/lib/session-start.ts` so the injected body is only the root `index.md` (the top-level catalog of branches and root-level leaves produced by Plan 1) instead of the entire flat `INDEX.md` catalog, and replace the grep-the-flat-catalog navigation directive with a descent directive. Expose the descent directive text as a single exported constant so the static AGENTS.md pointer (task 2) can reuse the exact same wording. Preserve the snapshot-verification note, the `nodes_hash` drift/staleness line, the curation-queue nudge, and the lint summary exactly as they behave today.

## Skills Required
- `typescript`: modify the injection builder and its helpers while keeping the `SessionStartResult` contract and the per-harness call sites working unchanged.

## Acceptance Criteria
- [ ] The injected body is the root index node body only; the payload no longer grows linearly with total node count (it grows by a fixed amount as leaves are added to deep folders).
- [ ] The navigation directive is replaced with a descent directive that instructs: read the injected root index node; identify the branches whose intent/tags match the task; read those branch index nodes; descend further only where the task needs it; open only the leaves that are confirmed relevant; and follow `relates_to` / `depends_on` cross edges to reach related leaves in other branches. It states explicitly that multiple branches can be relevant and that the agent chooses depth.
- [ ] The descent directive text is exported once (e.g. `export const KK_NAVIGATION_DIRECTIVE = ...`) so task 2 can import the same string; the hook injection uses this constant.
- [ ] The `nodes_hash` drift check still fires (now comparing the live hash against the root index node's frontmatter hash) and the staleness line is unchanged in spirit.
- [ ] The curation-queue nudge (including the loud variant) and the lint summary line are byte-for-byte unchanged in behavior.
- [ ] The `SessionStartResult` interface and the exported `buildNudgeContent`, `summarizePendingSessions`, `countPendingSessions` signatures are preserved so all five harness hooks compile without edits to their call sites.
- [ ] No em dashes in any changed file.
- [ ] `npm run typecheck` passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File to modify: `src/lib/session-start.ts`.
- The root index node is the top-level `index.md` produced by Plan 1's tree storage. Resolve its path from the existing kk directory paths (the same `ctx.kkDir` the current `loadIndex` uses). If Plan 1 names the root index node `index.md` at the KB root, load that; keep the empty-KB stub fallback behavior.
- Source the directive text from a single exported constant. Do not inline the directive string at two call sites.
- Do not change curation, rebalance, or storage logic. This is the discovery surface only.
- Keep the Cursor and OpenCode call paths working by leaving `buildNudgeContent` and the result shape intact; their channel-specific handling lives in their own hooks (covered by task 3).

## Input Dependencies
None. This is the first task. It assumes Plan 1's root index node exists (clean break, no backwards compatibility beyond Plan 1).

## Output Artifacts
- Updated `src/lib/session-start.ts` injecting the root index node body and the descent directive.
- An exported `KK_NAVIGATION_DIRECTIVE` (or equivalently named) constant for reuse by task 2.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `src/lib/session-start.ts` fully. The current `loadIndex(kkDir)` reads `<kkDir>/INDEX.md`, parses frontmatter, and returns the body plus the `nodes_hash`. The injection assembles `lines`: index body, snapshot note, navigation directive, staleness line, nudge, lint summary.
2. Change `loadIndex` to load the root index node (`index.md` at the KB root per Plan 1) instead of the flat `INDEX.md`. Keep returning `{ content, frontmatterHash, missing }`. Keep the empty-KB stub when the file is absent. The `frontmatterHash` must come from the root index node's frontmatter `nodes_hash` so the drift check stays meaningful (the plan: "it now compares against the root index node's frontmatter hash").
3. Add an exported constant holding the descent directive text. Suggested shape, prefixed with `> ` as the current directive is, single blockquote paragraph or a few lines. It must cover: read the injected root index node; pick one or more relevant branches by intent/tags; read those branch index nodes; descend only as deep as the task needs; open only confirmed-relevant leaves; follow `relates_to` / `depends_on` cross edges to other branches; multiple branches may be relevant and the agent decides depth. Do not use em dashes.
4. Replace the old grep directive push (the `> kenkeep navigation: consult the index above first, then \`grep -C 2 <term> nodes/\` ...` line) with a push of the new exported constant.
5. Leave the snapshot-verification note, the staleness line, the nudge block (loud and quiet variants), the lint summary, and the `writeState` nudge persistence exactly as they are.
6. Run `npm run typecheck`. Fix only type errors caused by your change.
7. Record the exported constant name and the new root-index resolution for task 2 and task 3.

</details>
