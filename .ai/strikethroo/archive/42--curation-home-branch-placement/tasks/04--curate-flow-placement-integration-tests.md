---
id: 4
group: "tests"
dependencies: [1, 2]
status: "completed"
created: 2026-06-05
skills:
  - vitest
complexity_score: 5
complexity_notes: "Integration coverage of the deterministic curate primitives that implement placement: folder-aware writer, dedup home_folder passthrough, and the root fallback. Skill reasoning is not executed in tests; the primitives are the testable surface."
---
# Integration tests for folder-aware placement, dedupe-update, and the root fallback

## Objective
Add focused integration tests over the deterministic curate primitives that
implement home-branch placement: the folder-aware `node write` (Task 1), the
`home_folder` passthrough through `curate-dedup` (Task 2), and the root
fallback. Cover the critical paths the plan calls out (placement into a chosen
folder, dedupe-update in place by id, and the no-good-fit root fallback) without
duplicating framework or trivial-CRUD coverage.

## Skills Required
- **vitest**: extend the existing curate/node-write test suites with
  sandbox-based integration cases asserting on-disk placement and survivor
  shape.

## Acceptance Criteria
- [ ] A test drives `node write` with a `--folder <relpath>` argument and asserts the leaf is written to `nodes/<folder>/<id>.md`, the printed id is unchanged versus a no-folder write of the same kind+title, and identity is folder-independent.
- [ ] A test asserts the root fallback: `node write` with no/empty folder writes the leaf at `nodes/<id>.md` (root) and is treated as success, not an error.
- [ ] A test asserts a folder argument that escapes `nodes/` (absolute path or `..` traversal) is rejected with a non-zero exit and no file is written (mirrors Task 1's guard).
- [ ] A test asserts a duplicate/update path keeps the id and writes in place at its current path with no relocation (update-in-place semantics by id).
- [ ] A test feeds `curate-dedup` an `add` action carrying `home_folder` and asserts the survivor in `$SURVIVORS` retains `home_folder` unchanged, and that `modify`/`contradict`/`drop` actions without it are unaffected.
- [ ] `npm test` passes (the run includes `pretest` build), and the new tests fail if the folder routing or the `home_folder` passthrough regress.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Follow the existing sandbox patterns in `tests/commands/node-write.test.ts`,
`tests/lib/nodes.test.ts`, and `tests/commands/curate-dedup.test.ts`
(mkdtemp sandbox, fixed run id / fixed now where applicable, golden files for
dedup). Reuse the `curate-dedup` fixture shape under
`tests/fixtures/curate/proposals/` rather than inventing a new harness. Do not
attempt to execute the LLM curate skill; the skill's reasoning is not unit
testable, so test the primitives it composes. No em dashes in changed files
(`practice-no-em-dashes`).

## Input Dependencies
- Task 1: folder-aware `node write` (`--folder`, root fallback, traversal
  rejection) and the updated `nodes.ts` write helpers.
- Task 2: `CuratorActionSchema.home_folder` carried through `dedupActions` and
  `curate-dedup` into `$SURVIVORS`.

## Output Artifacts
- New/extended test cases under `tests/commands/node-write.test.ts` (and/or
  `tests/lib/nodes.test.ts`) for folder routing, root fallback, traversal
  rejection, and update-in-place.
- New/extended cases under `tests/commands/curate-dedup.test.ts` (plus a fixture
  update if needed) for `home_folder` passthrough.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Read `tests/commands/node-write.test.ts` and `tests/lib/nodes.test.ts` to
   reuse their sandbox setup (mkdtemp root, initialized `.ai/kenkeep`, injected
   `readStdin`/`isTTY`/`writeStdout` deps for `runNodeWriteCommand`).
2. Folder routing test: write a node with `--folder <relpath>` (a relative path
   under `nodes/`, e.g. `practice/sub`) and assert the file exists at
   `nodes/<relpath>/<id>.md`. Capture the printed id; do a second write of the
   same kind+title with no folder and assert the derived id is identical
   (identity is folder-independent), differing only in path.
3. Root fallback test: write with `--folder ""` (or omitted) and assert the
   file lands at `nodes/<id>.md` and the command returns exit 0.
4. Traversal rejection test: write with `--folder "../escape"` and with an
   absolute path; assert non-zero exit and that no file was created under or
   outside `nodes/`.
5. Update-in-place test: write a node, then perform the update path
   (re-write/modify against the same id) and assert the id is unchanged and the
   file remains at its original path (no second file, no relocation).
6. Dedup passthrough test: build an input actions array (reuse/extend
   `tests/fixtures/curate/proposals/input.json` or build inline) including one
   `add` with `home_folder: "practice/sub"`. Run `runCurateDedupCommand` with a
   fixed run id / now against a sandbox; read `$SURVIVORS` and assert the
   surviving `add` retains `home_folder` exactly, and that a `drop`/`modify`
   without it is unchanged. If you extend the golden survivors fixture, update
   `survivors.golden.json` accordingly.
7. Apply the test philosophy below: a few integration tests over the custom
   placement logic and critical paths, not exhaustive per-method units.
8. Run `npm test` and confirm exit 0; confirm the new tests fail when the
   folder routing or `home_folder` passthrough is reverted.

</details>

<details>
<summary>Test philosophy: "write a few tests, mostly integration"</summary>

When generating test tasks, keep this constraint.

**Definition.** Meaningful tests verify custom business logic, critical paths,
and edge cases specific to this application. Test your code, not the framework
or library.

**When TO write tests:** custom business logic and algorithms; critical user
workflows and data transformations; edge cases and error conditions for core
functionality; integration points between components; complex validation logic
or calculations.

**When NOT to write tests:** third-party library functionality; framework
features; simple CRUD operations without custom logic; trivial getters/setters
or static configuration; obvious functionality that would break immediately if
incorrect.

**Test task creation rules:** combine related test scenarios into a single task;
favor integration and critical-path coverage over per-method unit tests; avoid
one test task per CRUD operation; question whether simple functions need a
dedicated test task.

</details>
