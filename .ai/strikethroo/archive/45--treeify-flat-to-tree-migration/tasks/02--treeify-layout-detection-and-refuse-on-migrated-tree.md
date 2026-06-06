---
id: 2
group: "treeify-core"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - typescript
---
# Treeify layout detection: detect an already-migrated (tree) KB and refuse with a clear message

## Objective
Implement the one-time guard for treeify: a deterministic detector that inspects an existing knowledge base and decides whether it is the old flat `nodes/<kind>/` layout (eligible for migration) or the new tree layout (already migrated). When the KB is already in the tree layout (or already at the new `schema_version`), treeify must refuse to run and emit a clear message pointing the user to curate or rebalance instead, making no changes.

## Skills Required
- `typescript`: add a layout-detection helper that reads the KB on disk / its `schema_version` and returns a clear flat-vs-tree verdict, plus the refusal message.

## Acceptance Criteria
- [ ] A detection function (e.g. `detectKbLayout(rootDir)` in `src/lib/treeify.ts`) returns a discriminated result indicating `"flat"`, `"tree"`, or `"empty/unknown"`.
- [ ] Detection is based on the presence of the flat `nodes/<kind>/` directory shape versus the tree layout shape and/or the current `schema_version` value defined by Plan 1; it does not rely on LLM judgment.
- [ ] When the layout is already tree (or already at the new `schema_version`), the treeify entry point refuses: it makes zero filesystem changes and prints a clear message stating the KB is already migrated and directing the user to `curate` / `rebalance`.
- [ ] When the layout is flat, detection reports `"flat"` so the launcher (Task 3) may proceed.
- [ ] The refusal path returns a non-zero-but-clean signal the launcher can act on (e.g. throws a typed `AlreadyMigratedError` or returns a verdict the command surfaces as a friendly refusal), and never partially writes.
- [ ] No em dashes in changed files. `npm run typecheck` and `npm run lint` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse the `schema_version` constant from Plan 1 (do not hardcode a divergent value); the cleanest detection signal is comparing the KB's `schema_version` against the current value, with the flat-vs-tree directory shape as the corroborating check.
- This is the mitigation for the "running on an already-migrated tree" technical risk in the plan; the message must be actionable, not a bare error.
- Keep detection deterministic and side-effect free (read-only).

## Input Dependencies
None. (Consumed by Task 3.)

## Output Artifacts
- Layout-detection helper and refusal error/verdict added to `src/lib/treeify.ts` (or a sibling module).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Determine how Plan 1 (Plan 41) represents the new tree layout on disk and where `schema_version` lives in node frontmatter and/or an index. Search `src/` for `schema_version` and for the tree-layout reader/index module from Plan 41.
2. Implement `detectKbLayout(rootDir)`:
   - If the KB root is empty or has no recognizable nodes, return `"empty/unknown"`.
   - If nodes sit under flat `nodes/<kind>/` directories and/or carry the pre-migration `schema_version`, return `"flat"`.
   - If the tree layout shape is present and/or nodes carry the current `schema_version`, return `"tree"`.
3. Provide a typed refusal (e.g. `class AlreadyMigratedError extends Error`) or a verdict object with a ready-to-print message such as: the KB is already in the tree layout; treeify is a one-time migration and will not reshuffle an established tree; use `curate` or `rebalance` to evolve it.
4. The function must make no writes. Run `npm run typecheck && npm run lint`. Keep changed files free of em dashes.

</details>
