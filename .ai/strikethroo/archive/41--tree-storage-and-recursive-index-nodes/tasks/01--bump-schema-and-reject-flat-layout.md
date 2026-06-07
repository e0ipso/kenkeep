---
id: 1
group: "schema-and-reader"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - typescript
  - zod-schemas
---
# Bump schema_version and reject the old flat layout

## Objective
Bump `schema_version` in the kenkeep node/index/graph schemas as a clean break,
and make the reader reject the old flat `nodes/<kind>/` layout (or old
`schema_version`) with a clear message pointing the user to re-init. No migrator
and no compatibility shim are introduced, per
`practice-strict-schema-version-bump-policy`.

## Skills Required
- **typescript**: edit `src/lib/schemas.ts` and the reader path in TypeScript.
- **zod-schemas**: update the Zod literal `schema_version` constraints and keep
  `.strict()` semantics consistent.

## Acceptance Criteria
- [ ] `NodeFrontmatterSchema`, `IndexFrontmatterSchema`, and
  `GraphFrontmatterSchema` in `src/lib/schemas.ts` carry the bumped
  `schema_version` literal (the next integer after the current `1`).
- [ ] The node reader detects either the old `schema_version` or the old flat
  `nodes/<kind>/` layout and rejects it with a clear, actionable error message
  that names re-init as the remedy.
- [ ] No migrator function and no backwards-compatibility shim exist in the
  changed code paths.
- [ ] `kind` remains a frontmatter field on `NodeFrontmatterSchema` (it is not
  removed); only its directory-determining role is dropped (handled in task 2).
- [ ] `npm run typecheck` passes for the changed files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
The schema bump is driven by the change in `kind` semantics and the storage
layout, not by adding or removing frontmatter fields. The reader must fail
loudly rather than misparse an old KB. The error message must point to re-init.

## Input Dependencies
- None. This is a foundational source-of-truth edit.

## Output Artifacts
- Updated `src/lib/schemas.ts` with bumped `schema_version` literals.
- Reader code that rejects the old layout with a re-init message.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. In `src/lib/schemas.ts`, change the `schema_version: z.literal(1)` on
   `NodeFrontmatterSchema` (line ~140), `IndexFrontmatterSchema` (line ~185),
   and `GraphFrontmatterSchema` (line ~191) to the next integer (`2`). Do not
   touch unrelated schemas (session log, state file, etc.) unless the plan's
   later tasks require it; this plan concerns node/index/graph artifacts.
2. Keep `kind: NodeKindSchema` on `NodeFrontmatterSchema`. Do not remove it.
3. Locate the node reader (the code that loads node frontmatter and walks
   `nodes/`; search `src/lib/nodes.ts` and any KB-load entry point). Add an
   explicit guard: if a node file fails the bumped `schema_version` check, or if
   the on-disk layout matches the old flat `nodes/<kind>/` shape (e.g. a
   `nodes/map/` or `nodes/practice/` directory with leaf docs and no per-folder
   `index.md`), throw/exit with a clear message instructing the user to re-init.
4. Do NOT write any migration logic. The clean break is intentional; Plan 5
   handles migration.
5. Run `npm run typecheck` and fix type errors introduced by the bump.

Note: the recursive generator, leaf placement, nodes_hash, and lint changes are
separate tasks (2-5). This task is only the schema bump and reader rejection.
</details>
