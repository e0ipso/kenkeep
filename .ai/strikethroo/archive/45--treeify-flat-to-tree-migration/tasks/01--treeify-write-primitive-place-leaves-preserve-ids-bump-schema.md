---
id: 1
group: "treeify-core"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 6
complexity_notes: "Identity-preserving file moves plus a schema_version bump with a strict no-overwrite, no-id-mutation contract; the migration's correctness anchor."
---
# Deterministic treeify write primitive: place flat leaves into topical folders preserving ids and edges, bump `schema_version`

## Objective
Implement a deterministic, non-LLM write primitive that takes a set of leaf-to-folder placements (computed by the launcher in Task 3) and migrates the existing flat `nodes/<kind>/` knowledge base into the tree layout: write each leaf into its assigned topical folder with its `id`, `relates_to`, and `depends_on` edges unchanged, bump each migrated leaf's frontmatter `schema_version` to the new value, and refuse to overwrite anything that already exists in the target tree. This primitive contains no clustering judgment; it only executes placements deterministically.

## Skills Required
- `typescript`: add a treeify write function (mirroring the existing `src/lib/bootstrap.ts` / `src/lib/nodes.ts` / `src/lib/fs-atomic.ts` patterns) plus its schema/types, with byte-stable, id-preserving output.

## Acceptance Criteria
- [ ] A new deterministic primitive (e.g. `src/lib/treeify.ts` exporting a `writeTreeifyPlacements(...)` function) accepts a list of `{ id, sourcePath, targetFolder }` placements and the resolved KB root.
- [ ] For each placement, the leaf is written to its target topical folder with the same `id` and the same `relates_to` / `depends_on` edge values it had in the flat layout (verified by reading frontmatter before and after).
- [ ] Each migrated leaf's frontmatter `schema_version` is bumped to the new layout's value (the value Plan 1/41 defines as current); no other frontmatter field is mutated.
- [ ] The primitive never overwrites an existing file at a target path: if a target already exists, it aborts with a clear error and leaves the KB unchanged (mirrors `practice-bootstrap-never-overwrites-existing-nodes`).
- [ ] Writes go through the existing atomic-write helper (`src/lib/fs-atomic.ts`) so an interrupted run leaves no partially written leaf.
- [ ] The primitive does not commit, does not stage, and does not invoke git; it only writes files to disk.
- [ ] No em dashes are introduced in any changed file (`practice-no-em-dashes`).
- [ ] `npm run typecheck` and `npm run lint` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse the schema_version constant / current layout value defined by Plan 1 (Plan 41); do not hardcode a divergent number. Locate it (e.g. in `src/lib/schemas.ts` or the index/layout module from Plan 41) before writing.
- Preserve ids exactly: the migration's whole purpose is that `relates_to` / `depends_on` keep resolving, so id is the anchor and must never be derived from or coupled to the new folder placement.
- Index-node and `GRAPH.md` generation is NOT this task's job: Plan 1's deterministic `index-rebuild` (see `src/commands/index-rebuild.ts` / `src/lib/index-gen.ts`) generates those after the leaves are placed. This primitive writes leaves only.
- The function must be pure with respect to clustering: it receives placements as input and never decides folders itself.

## Input Dependencies
None. (This primitive is consumed by Task 3 but can be built and unit-tested independently.)

## Output Artifacts
- New `src/lib/treeify.ts` (or equivalent) with the deterministic write primitive and its placement/type definitions.
- Any small additions to `src/lib/schemas.ts` needed to express the placement input type.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `src/lib/bootstrap.ts`, `src/lib/nodes.ts`, `src/lib/fs-atomic.ts`, `src/lib/paths.ts`, and `src/lib/schemas.ts` to learn the existing node read/write, frontmatter parse/serialize, atomic-write, and path-resolution conventions. Reuse them; do not introduce a new YAML or fs library.
2. Locate the current `schema_version` value introduced by Plan 1 (Plan 41). Search `src/` for `schema_version` and import/reuse that constant. Do not invent a new number.
3. Define a placement input type, e.g. `interface TreeifyPlacement { id: string; sourcePath: string; targetFolder: string }`, and a result type that reports each placed leaf and its destination (used by the launcher's report in Task 3).
4. Implement `writeTreeifyPlacements(rootDir, placements)`:
   - First pass (no writes): for every placement, resolve the target path and verify nothing already exists there. If any target exists, throw a clear error naming the conflicting path and make zero writes (all-or-nothing; do not leave a half-migrated tree).
   - Second pass: for each placement, parse the source leaf's frontmatter, assert the id is present and unchanged, set `schema_version` to the current value, leave `relates_to` / `depends_on` and all other fields untouched, serialize, and write atomically to the target path via `fs-atomic`. Remove the old flat-location file (so `git diff` shows a rename, not a duplicate) only after the target is written successfully.
   - Return the result list of `{ id, from, to }`.
5. Do not call git, do not stage, do not generate index nodes or `GRAPH.md`.
6. Keep all changed files free of em dashes. Run `npm run typecheck && npm run lint`.

</details>
