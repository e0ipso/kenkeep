---
id: 4
group: "test-suite-minimization"
dependencies: [3]
status: "completed"
created: 2026-06-05
skills:
  - vitest
  - documentation
complexity_score: 5
complexity_notes: "Final gate: trims top-level integration dupes, verifies the integration floor across the whole consolidated suite, and updates AGENTS.md."
---
# Dedupe top-level integration tests, verify the floor, and update docs

## Objective
Finish the consolidation: keep the top-level integration suites as the backbone (trimming redundancy and keeping a single `logs-prune` test), verify the integration floor holds across the whole consolidated suite, update the AGENTS.md Testing section to match the new layout, and produce the final deleted/consolidated/dropped report.

## Skills Required
- `vitest`: final suite run, floor verification, redundancy trim.
- `documentation`: update the AGENTS.md Testing section accurately.

## Acceptance Criteria
- [ ] The top-level integration suites (`init`, `upgrade`, `doctor`, `doctor-dangling`, `index-rebuild`, `logs-prune`) remain; only clearly duplicate cases are trimmed. The single surviving `logs-prune` test lives at `tests/logs-prune.test.ts` (the `tests/lib/` copy was removed in task 3).
- [ ] `tests/doctor.test.ts` still provides the per-adapter doctor-checks coverage (the fourth AGENTS.md per-adapter minimum).
- [ ] Integration floor verified: for every CLI command, every registered harness adapter (transcript, hooks-config registration, headless, doctor), and every hook pipeline there is at least one asserting test. Produce the mapping.
- [ ] `npm test` (`vitest run`, with its pretest build) passes with zero failures, and `npm run typecheck` passes.
- [ ] Total test cases reduced by at least 50 percent from the 433 baseline; report the final count.
- [ ] The AGENTS.md Testing section (around lines 115 to 120) is updated to describe the consolidated, parametrized layout while preserving the four-area per-adapter coverage statement. No new doc files are created.
- [ ] `git diff --name-only HEAD -- src dist` prints nothing (no production code changed).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Owned files (the ONLY files this task may modify): `tests/init.test.ts`, `tests/upgrade.test.ts`, `tests/doctor.test.ts`, `tests/doctor-dangling.test.ts`, `tests/index-rebuild.test.ts`, `tests/logs-prune.test.ts`, and `AGENTS.md`.
- This task also runs read-only verification commands across the whole `tests/` tree.

## Input Dependencies
- Task 3 completed and the suite green.

## Output Artifacts
- The final consolidated suite, an updated AGENTS.md, and the execution-summary report (files deleted, files consolidated, edge cases intentionally dropped, before/after case counts, integration-floor mapping).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Confirm `npx vitest run` is green at start.
2. Trim only clearly duplicate cases in the top-level suites; keep init, upgrade, doctor, doctor-dangling, index-rebuild, and logs-prune each covered. Keep `tests/doctor.test.ts` asserting doctor checks across adapters.
3. Verify the integration floor: run `grep -rlE "describe\(|it\(|test\(" tests/` and map each CLI command, each registered adapter (transcript, hooks-config registration, headless, doctor), and each hook pipeline to at least one asserting file. If any path is uncovered, restore a minimal assertion before finishing.
4. Run `npm test` and `npm run typecheck`; both must pass. If typecheck fails on dangling type-only imports left by deletions, fix the imports (test files only).
5. Count final test cases (`grep -rcE "^\s*(it|test)\s*\(" tests/` summed) and confirm at least a 50 percent reduction from 433.
6. Update the AGENTS.md Testing section so it describes the parametrized adapter layout instead of per-adapter directories, keeping the sentence that each adapter must cover transcript parsing, hook registration round-trip, doctor checks, and headless-run option mapping.
7. Run `git diff --name-only HEAD -- src dist` and confirm empty output.
8. Write the final report: list every deleted file, every consolidated file, every intentionally dropped edge case, the before/after case counts, and the integration-floor mapping.
</details>

<details>
<summary>Test philosophy (apply verbatim)</summary>

Write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library.

Write tests for: custom business logic and algorithms; critical user workflows and data transformations; edge cases and error conditions for core functionality; integration points between components; complex validation logic.

Do NOT write tests for: third-party library functionality; framework features; simple CRUD without custom logic; trivial getters/setters or static configuration; obvious functionality that would break immediately if incorrect.

Rules: combine related scenarios into a single test; favor integration and critical-path coverage over per-method unit tests; avoid one test per CRUD operation; question whether simple functions need a dedicated test. The top-level suites (init, upgrade, doctor, index-rebuild) are the integration backbone and stay; the goal of this final task is to confirm the consolidated suite still proves the code works, not merely that it is smaller.
</details>
