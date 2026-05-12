---
id: 1
group: "schema"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Slim NodeFrontmatterSchema and CuratorProposedNodeSchema

## Objective

Remove the five temporal/lineage fields (`valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`) from `NodeFrontmatterSchema` and the four mirror fields (`valid_from`, `valid_until`, `supersedes`, `superseded_by`; the curator type never carried `updated`) from `CuratorProposedNodeSchema` in `src/lib/schemas.ts`. Inferred TypeScript types (`NodeFrontmatter`, `CuratorProposedNode`) must update automatically because they are derived via `z.infer`. `PendingConflictsFileSchema` follows automatically since its `proposed_node` embeds the curator type.

## Skills Required

- typescript: edit a zod schema module and confirm derived `z.infer` types propagate.

## Acceptance Criteria

- [ ] `NodeFrontmatterSchema.shape` exposes none of `valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`.
- [ ] `CuratorProposedNodeSchema.shape` exposes none of `valid_from`, `valid_until`, `supersedes`, `superseded_by`.
- [ ] No new field is added. The remaining shape is exactly: `id`, `title`, `kind`, `tags`, `derived_from`, `relates_to`, `depends_on`, `confidence`, `summary` (plus any other fields already present unrelated to the removed ones).
- [ ] No backwards-compat shim, alias, or transformer is introduced. The change is a clean break.
- [ ] No retrospective comments are added ("previously this had…", "removed for…"). Comments, if any, describe the current schema only.
- [ ] `npm run typecheck` reveals every downstream call site that read the removed fields. (Fixing those call sites belongs to other tasks; this task may leave the build temporarily red on downstream files but must not introduce schema-internal type errors.)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `src/lib/schemas.ts` (around lines 115-166 per the plan).
- The schemas are zod objects. Remove the lines for the listed fields. Leave field ordering of the survivors intact.
- `PendingConflictsFileSchema` does not need to be touched directly; verify by inspection that it composes `CuratorProposedNodeSchema` rather than redeclaring those fields.

## Input Dependencies

None.

## Output Artifacts

- `src/lib/schemas.ts` with trimmed schemas.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Open `src/lib/schemas.ts`. Locate `NodeFrontmatterSchema` (around line 115). Delete the lines defining `valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`.

2. Locate `CuratorProposedNodeSchema` (around line 140). Delete the lines defining `supersedes`, `valid_from`, `valid_until`, `superseded_by`.

3. Skim the file for any other reference to those identifiers (helpers, narrower derived schemas, defaults). Remove anything that exists only to support the removed fields. Do not remove fields used by other features.

4. Run `npm run typecheck` to confirm the schema file itself compiles. Downstream errors are expected and will be resolved by tasks 2, 3, 5, and 6; do not fix them in this task.

5. Run `grep -n "valid_from\|valid_until\|updated\|supersedes\|superseded_by" src/lib/schemas.ts`; expect no hits.

6. Do not add explanatory comments. The schema is now self-describing.

</details>
