---
id: 4
group: "treeify-verification"
dependencies: [3]
status: "completed"
created: 2026-06-05
skills:
  - vitest
complexity_score: 5
complexity_notes: "Integration-level coverage of the migration critical path (id/edge preservation, schema_version bump, no-overwrite, refuse-on-migrated) against a flat-KB fixture; the migration's correctness gate."
---
# Tests: treeify migration critical path and refuse-on-migrated-tree

## Objective
Add focused integration tests that verify the treeify migration's custom business logic against a flat-KB fixture: every leaf is placed in a topical folder; every leaf keeps its `id`, `relates_to`, and `depends_on` edges; only folder placement and `schema_version` change; the write primitive never overwrites an existing target; the migration report lists every placement; and running treeify on an already-migrated tree refuses with the expected message and makes no changes. After migration, a doctor check (or its dangling-ref logic) confirms no edge dangles.

## Skills Required
- `vitest`: add integration tests using a flat-KB fixture and the project's existing test conventions, asserting on-disk results and the refusal path.

## Acceptance Criteria
- [x] A flat-KB fixture (a small set of flat `nodes/<kind>/` leaves with `relates_to` / `depends_on` edges among them) exists under the test fixtures and is used by the tests.
- [x] A test migrates the fixture and asserts: every leaf ends up in a topical folder; every leaf's `id` is unchanged; every `relates_to` / `depends_on` value is unchanged; each migrated leaf's `schema_version` equals the new value; no other frontmatter field changed.
- [x] A test asserts the write primitive refuses to overwrite: when a target path already exists, the migration aborts and leaves the KB unchanged (no partial writes).
- [x] A test asserts the migration report lists every leaf id and its assigned folder (plan Success Criterion 6).
- [x] A test asserts that running treeify on an already-migrated (tree) fixture refuses with the expected message and makes zero filesystem changes (plan Success Criterion 5).
- [x] A test (reusing doctor's dangling-ref detection from `src/commands/doctor.ts`) confirms no edge dangles after migration (plan Success Criterion 3, edge half).
- [x] LLM clustering is stubbed/injected so tests are deterministic and do not exec the host harness; tests cover the deterministic write/detect/report/refuse logic, not the model.
- [x] No em dashes in changed files. `npm run typecheck`, `npm run lint`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Stub or inject the clustering step (the launcher's host-harness call) so the deterministic placements are supplied directly by the test; do not exec the real harness or the LLM in tests, and do not run treeify in CI's live form.
- Reuse the existing test harness conventions (look at the curate/bootstrap/index-rebuild tests) for fixture setup, temp-dir KB roots, and frontmatter assertions.
- Assert on-disk state via the project's node read helpers, and assert `git`-visible renames are not id changes by comparing parsed frontmatter ids before/after (not by shelling out to git).

## Input Dependencies
- Task 3: the `treeify` launcher (and through it Task 1's write primitive and Task 2's detector) must exist and be invocable with an injectable clustering result.

## Output Artifacts
- New test file(s) for treeify (e.g. `test/treeify.test.ts` or alongside existing command tests), plus a flat-KB fixture under the test fixtures directory.

## Implementation Notes

Test philosophy for this task ("write a few tests, mostly integration"): Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. WRITE tests for: custom business logic and algorithms; critical user workflows and data transformations; edge cases and error conditions for core functionality; integration points between components; complex validation logic. Do NOT write tests for: third-party library functionality; framework features; simple CRUD without custom logic; trivial getters/setters or static configuration; obvious functionality that would break immediately if incorrect. Combine related scenarios into a single task; favor integration and critical-path coverage over per-method unit tests; avoid one test task per CRUD operation; question whether simple functions need a dedicated test.

<details>
<summary>Step-by-step</summary>

1. Read the existing command tests (e.g. for `bootstrap`, `curate`, `index-rebuild`) to learn the project's vitest conventions: how a temp KB root is created, how fixtures are laid out, and how frontmatter is asserted.
2. Create a small flat-KB fixture: a handful of flat `nodes/<kind>/` leaves carrying ids and `relates_to` / `depends_on` edges that reference each other, plus the pre-migration `schema_version`.
3. Write the migration happy-path test: invoke the treeify launcher with an injected clustering result (the deterministic `TreeifyPlacement[]`), then assert: every leaf moved into its folder; ids unchanged; edges unchanged; `schema_version` bumped; no other field changed; the report lists each `id -> folder`.
4. Write the no-overwrite test: pre-create a file at a target path, run the migration, assert it aborts and the KB is unchanged (all-or-nothing).
5. Write the refuse-on-migrated test: point the launcher at a tree-layout fixture (or one already at the new `schema_version`), assert the refusal message and zero filesystem changes.
6. Write the dangling-ref test: after a successful migration, run doctor's dangling-ref detection and assert no edge dangles.
7. Keep changed files free of em dashes. Run `npm run typecheck && npm run lint && npm test`.

</details>
