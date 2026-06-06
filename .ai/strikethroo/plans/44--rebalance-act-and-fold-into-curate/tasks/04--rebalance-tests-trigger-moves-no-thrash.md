---
id: 4
group: "verification"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-06-05
skills:
  - vitest
  - typescript
complexity_score: 6
complexity_notes: "Covers the load-bearing invariants the plan calls out as test requirements: deterministic trigger + hysteresis, the no-thrash property (curate twice on a borderline fixture is a structural no-op on the second run), content-byte-stable renames with stable ids, split-leaf new ids + redirect, and skip-when-balanced. Integration-first over the curate flow; a few focused unit tests on the trigger thresholds."
---
# Tests: trigger + hysteresis, no-thrash, rename/id stability, skip-when-balanced

## Objective
Write the tests the plan's success criteria and risk mitigations require:
the deterministic trigger and its hysteresis behavior, the no-thrash property
(running curate twice on a borderline fixture yields a structural no-op on the
second run), the move primitive's content-byte-stable renames and id stability,
split-leaf minting new ids plus a redirect, and the skip-the-LLM-phase path when
the tree is balanced. Favor integration coverage of the curate rebalance flow,
with a few focused unit tests on the trigger thresholds.

## Skills Required
- `vitest`: author the test suites and fixtures.
- `typescript`: drive the trigger and move primitives and assert on the
  resulting working-tree diff (renames, ids, regenerated index nodes).

## Acceptance Criteria
- [ ] A unit test asserts the trigger is deterministic (same metrics -> identical output) and that the hysteresis gap holds: a folder just past the merge low-water but below the split high-water trips nothing.
- [ ] A no-thrash integration test runs curate (or the rebalance phase) twice on a borderline fixture and asserts the **second** run performs no structural change.
- [ ] A skip-when-balanced test drives the rebalance phase on a balanced fixture and asserts the trigger reports no action and the LLM clustering step is not entered (structural summary reports no actions).
- [ ] A split-folder integration test on an over-full folder fixture asserts a split occurs, moved leaves keep their ids, the relocation is byte-stable (recorded as a rename / no content delta on moved files), and the affected index nodes regenerate.
- [ ] A split-leaf test on a bloated-leaf fixture asserts the leaf becomes a folder of an index node plus two or more documents, with new ids and a recorded redirect from the old id.
- [ ] A determinism test asserts the post-move rebuild is byte-stable (a second rebuild after a fixed move is a no-op).
- [ ] Tests assert nothing is committed by the primitives/skill (changes remain in the working tree).
- [ ] No em dashes in any changed file.
- [ ] `npm test`, `npm run typecheck`, and `npm run lint` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Add tests under the existing `tests/` tree mirroring the repo's current
  structure and fixture conventions.
- Do not run the real LLM in tests. For the rebalance phase, drive the
  deterministic trigger and the deterministic move primitive directly with a
  fixed operation plan (the same shape the LLM would emit) so the structural
  outcome is deterministic and assertable; the no-thrash and skip tests key on
  the trigger output, which is LLM-free.
- Assert byte stability by comparing moved-file bytes before/after and/or by
  inspecting `git diff --summary` for `R` entries on a git fixture.
- No em dashes in changed files (`practice-no-em-dashes`).

## Input Dependencies
- Task 1 (trigger), Task 2 (move primitive + rebuild), Task 3 (curate phase
  wiring) must be implemented; this task verifies them.

## Output Artifacts
- Vitest suites and fixtures covering trigger/hysteresis, no-thrash,
  skip-when-balanced, split-folder rename/id-stability, split-leaf ids+redirect,
  and post-move rebuild byte stability.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

Test philosophy for this task (apply verbatim): "write a few tests, mostly
integration." Meaningful tests verify custom business logic, critical paths, and
edge cases specific to this application. Test *your* code, not the framework or
library.

WHEN TO write tests: custom business logic and algorithms; critical user
workflows and data transformations; edge cases and error conditions for core
functionality; integration points between components; complex validation logic
or calculations.

WHEN NOT to write tests: third-party library functionality; framework features;
simple CRUD operations without custom logic; trivial getters/setters or static
configuration; obvious functionality that would break immediately if incorrect.

Rules: combine related test scenarios into a single task/suite rather than one
test per operation; favor integration and critical-path coverage over per-method
unit tests; avoid one test task per CRUD operation; question whether simple
functions need a dedicated test.

1. Build small on-disk fixtures: a balanced tree, an over-full folder, a sparse
   branch, a bloated single leaf covering two concepts, and a borderline tree
   sitting inside the hysteresis gap. Use a temp git repo where rename detection
   matters.
2. Trigger unit tests: feed metric inputs directly and assert deterministic
   output and the hysteresis gap (no action between low-water and high-water).
3. No-thrash: apply the rebalance flow to the borderline fixture twice; assert
   the second pass yields no structural action.
4. Skip-when-balanced: assert the trigger returns the empty result on the
   balanced fixture and the structural summary reports no actions.
5. Split-folder: apply a fixed split operation; assert moved leaves keep ids and
   stems, bytes are unchanged (rename, not rewrite), and affected index nodes
   regenerate; a second rebuild is a no-op.
6. Split-leaf: apply the operation; assert the document becomes a folder of an
   index node plus 2+ documents, new ids are minted, and a redirect from the old
   id is recorded.
7. Assert no commit happens (working tree dirty, nothing staged) after the flow.
8. Run `npm test`, `npm run typecheck`, `npm run lint`.

</details>
