---
id: 6
group: "validation"
dependencies: [4, 5]
status: "completed"
created: 2026-06-05
skills:
  - vitest
---
# Extend index-gen golden tests to the recursive layout and hash stability

## Objective
Update and extend `tests/lib/index-gen.test.ts` so the determinism golden tests
cover the recursive per-folder `index.md` layout, the global in-degree ordering,
empty/singleton folders, and `nodes_hash` stability (leaves only, excluding
generated `index.md`). Tests verify this plan's custom generation logic, not
framework behavior.

## Skills Required
- **vitest**: write and update golden-file / determinism tests.

## Acceptance Criteria
- [ ] Golden tests assert `generateIndex` emits one `index.md` body per folder
  for a multi-folder fixture, with content matching golden snapshots.
- [ ] A determinism test asserts two consecutive generations over the same leaf
  set are byte-identical (with `now` injected).
- [ ] A test asserts global in-degree ordering: a node's in-degree from edges in
  other folders affects its ordering within its own folder.
- [ ] Tests cover an empty folder and a single-child folder rendering a
  well-defined `index.md`.
- [ ] A test asserts `computeNodesHash` is stable across repeated rebuilds and
  is unchanged when generated `index.md` files are (re)written (no
  self-reference).
- [ ] A test confirms cross references render the resolved current path by `id`
  (no path-based references leak into output).
- [ ] `npm test` passes including these suites.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Favor integration and critical-path coverage of the recursive generator and the
hash contract over per-helper unit tests. Inject `now` to keep snapshots stable.

## Input Dependencies
- Task 4: the recursive generator (the system under test).
- Task 5: the write/stage wiring and the regenerated starter layout (fixture
  reference).

## Output Artifacts
- Updated `tests/lib/index-gen.test.ts` (and any golden fixture files) covering
  the recursive layout, ordering, edge cases, and hash stability.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Read the existing `tests/lib/index-gen.test.ts` to learn the current golden
   harness (fixture construction, `now` injection, snapshot comparison).
   Mirror that style.
2. Build a fixture KB with multiple nested topical folders, including an empty
   folder and a single-child folder, and `relates_to` edges that cross folder
   boundaries (to exercise global in-degree).
3. Assert: one `index.md` body per folder; byte-identical output across two
   generations; global in-degree affects intra-folder ordering; empty and
   singleton folders render valid bodies; `computeNodesHash` is stable across
   repeats and unaffected by writing `index.md`; cross references render via id
   resolution (current path), never a stored path.
4. Run `npm test`; update golden snapshots to the new deterministic output where
   the change is intentional, and confirm green.

Test philosophy for this and any test task in this plan: "write a few tests,
mostly integration." Meaningful tests verify custom business logic, critical
paths, and edge cases specific to this application; test your code, not the
framework or library. Write tests for custom business logic and algorithms,
critical workflows and data transformations, edge cases and error conditions
for core functionality, integration points between components, and complex
validation or calculations. Do NOT write tests for third-party library
functionality, framework features, simple CRUD without custom logic, trivial
getters/setters or static config, or obvious functionality that would break
immediately if incorrect. Combine related test scenarios into a single task,
favor integration and critical-path coverage over per-method unit tests, avoid
one test task per CRUD operation, and question whether simple functions need a
dedicated test.
</details>
