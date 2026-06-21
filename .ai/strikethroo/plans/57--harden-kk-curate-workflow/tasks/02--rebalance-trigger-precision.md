---
id: 2
group: "rebalance"
dependencies: []
status: "pending"
created: 2026-06-21
skills:
  - typescript
  - vitest
---
# Verify and complete rebalance trigger precision

## Objective
Make `rebalance trigger` output reflect actionable structural work: (1) suppress
`merge` for non-root folders that contain child subdirectories (only direct-leaf
under-occupancy + no child folders qualifies for merge), and (2) group related
root homeless leaves sharing a deterministic tag into a single `create-branch`
action carrying a stable representative `branch` plus optional `branches` and
`topic` metadata. Commit `e14fe72` already modified `src/lib/rebalance.ts` and
`tests/lib/rebalance.test.ts`; verify against the plan and complete any gap.

## Skills Required
TypeScript (deterministic data transformation, stable sorting) and Vitest.

## Acceptance Criteria
- [ ] A non-root folder with child subdirectories and zero direct leaves produces NO `merge` action.
- [ ] A non-root folder qualifies for `merge` only when below the direct-leaf occupancy threshold AND it has no child folders.
- [ ] Root homeless leaves sharing a deterministic useful tag are grouped into a single `create-branch` action.
- [ ] The grouped `create-branch` action keeps a stable representative `branch` field for older consumers and exposes optional `branches` and `topic` metadata for the complete group.
- [ ] Ordering is deterministic: identical trees produce byte-identical decisions (leaves, tags, groups, and final actions sorted with stable comparators).
- [ ] Tests cover branch-with-children merge suppression and deterministic grouping of shared-tag root leaves (exact grouped JSON asserted).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Edit confined to the deterministic decision layer `src/lib/rebalance.ts`; `rebalance move` remains the only structural writer (do not change its responsibilities here).
- Do NOT implement recursive merge — out of scope. Folders with children are simply non-mergeable under this trigger.
- Tests in `tests/lib/rebalance.test.ts`.

## Input Dependencies
None. Builds on already-committed `e14fe72`.

## Output Artifacts
Verified/complete `src/lib/rebalance.ts` trigger logic and tests. Consumed by
the skill-docs task (03, which documents the grouped semantics), docs task (04),
and validation task (05).

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Run `git show e14fe72 -- src/lib/rebalance.ts tests/lib/rebalance.test.ts` to see existing work. Preserve working code; fill gaps only.
2. Occupancy: treat a folder with child subdirectories as a meaningful descent point and therefore non-mergeable. The merge candidate predicate must require both under-threshold direct-leaf occupancy AND absence of child folders.
3. Grouping: cluster root homeless leaves by a single deterministic shared tag signal. Emit one `create-branch` per group. Keep backward-compatible `branch` (stable representative) and add optional `branches` (full member list) and `topic` metadata.
4. Determinism is a hard requirement: sort leaves, tags, groups, and actions with explicit stable comparators so identical input trees yield identical output. Cover the exact grouped JSON in a test.
5. Test philosophy — "write a few tests, mostly integration": assert the trigger's decision output on representative fixtures (a parent-with-only-children tree → no merge; a set of shared-tag root leaves → one grouped action). Do not test the sorting library itself.
6. Run `npx vitest run tests/lib/rebalance.test.ts` before declaring done. Report exactly which files you changed.
</details>
