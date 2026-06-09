---
id: 3
group: "step-gating"
dependencies: [1]
status: "completed"
created: 2026-06-09
skills:
  - typescript-node-cli
  - vitest
---
# Step-gate place inventory and place apply to on-disk version 1

## Objective
Make it impossible for the flat-to-tree transform to run against a tree it does not apply to: `runPlaceInventory` and `runPlaceApply` each verify the detected on-disk schema version is exactly 1 before doing anything, closing the latent bug where a future `NODE_SCHEMA_VERSION` bump would let `place apply` stamp the new version on un-migrated content.

## Skills Required
- `typescript-node-cli` — guard logic in the command layer of `src/commands/place.ts`.
- `vitest` — refusal tests extending the existing `tests/commands/place.test.ts`, including zero-filesystem-change assertions.

## Acceptance Criteria
- [ ] `runPlaceInventory` keeps its two existing exit-0 "nothing to do" outputs (no KB; already at `NODE_SCHEMA_VERSION` or above) verbatim, and gains a refusal for the "migration pending but detected version is not 1" case: clear `log.error` message that names the step actually pending from the detected version (looked up in the step registry) and points the caller at `kenkeep migrate status`, exit non-zero, zero filesystem changes.
- [ ] `runPlaceApply` gates before reading the placement document (before the `--input`/stdin read): unless the detected on-disk version is exactly 1, it refuses with a clear message pointing at `kenkeep migrate status`, exits non-zero, and makes zero filesystem changes. This covers no-KB, already-current, and pending-from-another-version alike.
- [ ] The gates live in the command layer (`src/commands/place.ts`) next to the existing version check — `writePlacements` and the rest of the placement library are untouched.
- [ ] Tests assert: on a current v2 tree, `place apply --input /dev/null` (or piped junk) refuses without touching the tree (compare the nodes directory before/after); on a synthetic fixture whose leaves carry a version other than 1 in a state where migration is pending (e.g. `schema_version: 0`), both `place inventory` and `place apply` refuse with the new messages; the existing v1 → v2 end-to-end flow still passes unchanged (ids and bytes preserved).
- [ ] Full test suite passes with no existing test weakened.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File under change: `src/commands/place.ts` (`runPlaceInventory` at lines 27–46, `runPlaceApply` at lines 93–146). Both already call `detectSchemaVersion`/have access to `paths.nodesDir`.
- Step lookup for the refusal message uses the registry constant from `src/lib/migrate.ts` (task 1).
- Tests extend `tests/commands/place.test.ts`, reusing its `writeFlatLeaf` helper and sandbox setup.

## Input Dependencies
- Task 1: the step registry, used to name the actually-pending step in inventory's refusal message.
- Soft dependency on task 2: the refusal text references the `migrate status` command by name; the message is correct prose either way, but end-to-end verification of the pointer needs task 2 merged.

## Output Artifacts
- Step-gated `place` primitives whose contract (refusal cases, exit codes, messages) tasks 4 and 5 describe in the SKILL.md and the CLI help/doc comments.
- Extended refusal coverage in `tests/commands/place.test.ts`.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

`runPlaceInventory` ordering after the change (the first two branches already exist at src/commands/place.ts:31–38 and keep their exact wording):

1. `current === null` → existing "No knowledge base found…" `log.plain`, return 0.
2. `current >= NODE_SCHEMA_VERSION` → existing "already at schema_version…" `log.plain`, return 0.
3. **New:** `current !== 1` → refusal. Message should (a) state that `place` implements only the `flat-to-tree` (1 → 2) step, (b) name the step actually pending from the detected version when the registry has one (`MIGRATION_STEPS.find(s => s.from === current)?.id`), or state that no step is registered from that version, and (c) point at `kenkeep migrate status` for the pending chain. `log.error`, return 1.
4. Otherwise proceed with the existing inventory emission.

`runPlaceApply`: insert the same detection + `current !== 1` refusal as the very first thing after `repoPaths(findRepoRoot())` — before `readFileSync`/`readStdin`. Per the plan this gate closes the silent-mislabel path: today, on a hypothetical version-2 tree with `NODE_SCHEMA_VERSION` 3, apply would relocate leaves and stamp version 3 without any transform having run. For apply, every `current !== 1` case refuses (there is no "nothing to do" exit-0 path for apply; it is meaningless without a valid plan to apply). Keep messages distinct enough to be diagnosable (no KB vs already current vs other step pending) but do not over-engineer — one parameterized message is fine.

Do not move the gate into `writePlacements` (src/lib/migrate-flat-to-tree.ts) — that is the step's internal write primitive and the plan explicitly keeps it gate-free.

Testing notes:
- "Zero filesystem changes" is best asserted by hashing or snapshotting the leaf paths + contents under the sandbox nodes dir before the refused call and comparing after (the existing test file already has `collectLeaves` and hashing utilities).
- For the pending-but-not-1 fixture, write nested-tree leaves whose frontmatter carries `schema_version: 0` — `detectSchemaVersion` returns the minimum leaf version, so the tree reads as 0 (< `NODE_SCHEMA_VERSION`, ≠ 1), hitting the new refusal branch in both commands.
- Check for existing tests that assert the current (ungated) behavior of inventory/apply on non-v1 trees and update their expectations to the new contract — but do not weaken the v1 end-to-end assertions (renames, byte preservation, schema_version as the only frontmatter change).

Test philosophy (apply when writing the tests): a few meaningful tests, mostly integration. The custom logic is the gate and its abort-before-write guarantee — cover the refusal branches and the unchanged-tree assertion, reuse the existing end-to-end test as the regression anchor, and skip per-message-string unit tests beyond what the contract needs.

</details>
