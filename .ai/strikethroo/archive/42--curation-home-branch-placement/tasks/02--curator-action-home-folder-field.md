---
id: 2
group: "schema"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - typescript
---
# Add an optional `home_folder` field to the curator-action schema

## Objective
Extend `CuratorActionSchema` in `src/lib/schemas.ts` with an optional
`home_folder` field so a new-leaf action can carry the chosen existing folder
through dedup to the persistence step. The field is optional so non-placement
actions (modify, contradict, drop) are unaffected, and so the dedup primitive
keeps passing whole action objects through untouched.

## Skills Required
- **typescript**: add an optional Zod field to an existing schema and confirm
  the inferred type and the dedup passthrough remain correct.

## Acceptance Criteria
- [ ] `CuratorActionSchema` gains `home_folder: z.string().nullable().optional()` (or equivalent optional/nullable string), documented inline as the chosen existing folder relative to `nodes/` for new-leaf placement; absent/null/empty means the root fallback.
- [ ] The inferred `CuratorAction` type exposes `home_folder` as an optional property; existing call sites still typecheck.
- [ ] `dedupActions` in `src/lib/curate.ts` continues to return whole action objects so `home_folder` survives dedup with no logic change (confirm by inspection; add a passthrough assertion only if a curate unit test already exercises dedup output shape).
- [ ] The dedup primitive (`curate-dedup`) still validates input against `CuratorOutputSchema` and writes survivors unchanged; a `home_folder` value present on an `add` action is preserved into `$SURVIVORS`.
- [ ] `home_folder` is never required and never validated as a path here (the writer's `--folder` guard in Task 1 owns traversal rejection); this task only carries the value.
- [ ] `npm run typecheck` and `npm run lint` pass for the changed files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
The `home_folder` field must be additive and optional. Adding it to the
non-strict `CuratorActionSchema` (note: the object is not `.strict()`, unlike
`CuratorProposedNodeSchema`) is sufficient to carry it; do not make
`proposed_node` carry placement, because placement is an action-level decision,
not a node-content field. No em dashes in changed files
(`practice-no-em-dashes`).

## Input Dependencies
- None. This is a leaf schema change with no prerequisite tasks.

## Output Artifacts
- Updated `src/lib/schemas.ts` (`CuratorActionSchema` + `CuratorAction` type).
- The `home_folder` action field consumed by Task 3 (the curate skill emits it)
  and exercised by Task 4 (integration tests assert it survives dedup).

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Open `src/lib/schemas.ts`. Locate `CuratorActionSchema` (currently the keys
   `action`, `candidate_origin`, `target_node_id`, `proposed_node`,
   `rationale`).
2. Add a new key: `home_folder: z.string().nullable().optional()`. Add a short
   comment: the chosen existing folder relative to `nodes/` for a new-leaf
   `add`; absent/null/empty selects the `nodes/` root fallback. Placement never
   changes the node id.
3. The exported `CuratorAction` type is `z.infer<typeof CuratorActionSchema>`,
   so it updates automatically. Confirm nothing that constructs a
   `CuratorAction` literal breaks (search for `CuratorAction` usages in
   `src/` and `tests/`).
4. Open `src/lib/curate.ts` and confirm `dedupActions` stores and returns the
   full action object (it does today via `byKey.set(key, action)`), so
   `home_folder` is preserved with no edit. Do not refactor dedup.
5. Confirm `src/commands/curate-dedup.ts` only validates against
   `CuratorOutputSchema` and writes `survivors` verbatim, so `home_folder` lands
   in `$SURVIVORS` untouched. No edit expected there either.
6. Run `npm run typecheck` and `npm run lint` on the touched file(s).

</details>
