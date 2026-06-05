---
id: 2
group: "test-suite-minimization"
dependencies: [1]
status: "completed"
created: 2026-06-05
skills:
  - vitest
  - typescript
complexity_score: 7
complexity_notes: "Parametrizes per-harness kk-capture and prunes four hook-related lib unit tests; must keep the session-start critical path asserted."
---
# Consolidate hook tests and prune redundant hook-level lib units

## Objective
Collapse the per-harness `kk-capture` hook tests into one parametrized test, and remove the `tests/lib/` unit tests whose behavior is already covered by the hook integration tests, while keeping at least one asserting test for the session-start critical path.

## Skills Required
- `vitest`: parametrize hook tests and trim redundant unit cases.
- `typescript`: keep imports and types valid after deletions.

## Acceptance Criteria
- [ ] The per-harness `kk-capture` tests (`tests/hooks/{codex,copilot,cursor}/kk-capture.test.ts`) are merged into the base `tests/hooks/kk-capture.test.ts` as a parametrized test over the harnesses, and the per-harness copies are deleted.
- [ ] `tests/hooks/kk-lint-tick.test.ts` and `tests/hooks/kk-proposal-drain.test.ts` are kept as integration entrypoint tests (trim only clearly redundant cases).
- [ ] `tests/lib/capture.test.ts` and `tests/lib/proposal-drain.test.ts` are deleted (covered by the corresponding hook integration tests).
- [ ] The session-start critical path keeps at least one asserting test: consolidate `tests/lib/session-start.test.ts` down to the essential integration-level assertions rather than deleting it outright. `tests/lib/session-log.test.ts` may be deleted if its behavior is covered by `tests/commands/session-log-update-proposals.test.ts` (owned by task 3) and the surviving session-start test; otherwise keep a trimmed version.
- [ ] `npx vitest run` passes with zero failures.
- [ ] Only files in this task's ownership set are modified; `src/` and `dist/` untouched.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Owned files (the ONLY files this task may modify or delete):
  - `tests/hooks/kk-capture.test.ts` (becomes the parametrized base)
  - `tests/hooks/codex/kk-capture.test.ts`, `tests/hooks/copilot/kk-capture.test.ts`, `tests/hooks/cursor/kk-capture.test.ts`
  - `tests/hooks/kk-lint-tick.test.ts`, `tests/hooks/kk-proposal-drain.test.ts`
  - `tests/lib/capture.test.ts`, `tests/lib/proposal-drain.test.ts`, `tests/lib/session-log.test.ts`, `tests/lib/session-start.test.ts`
- The `claude` subprocess is mocked. Do not require a real binary.

## Input Dependencies
- Task 1 completed and the suite green (sequential chain; avoids concurrent edits to the shared suite).

## Output Artifacts
- Consolidated hook test layout and a green `vitest run` for the next task.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Confirm `npx vitest run` is green at the start (task 1 should have left it green).
2. Read the four `kk-capture` files. They assert the capture-hook pipeline per harness. Merge into `tests/hooks/kk-capture.test.ts` using `it.each` over the harness ids, keeping one representative assertion set per harness. Delete the three per-harness copies.
3. Read `tests/lib/capture.test.ts` and `tests/lib/proposal-drain.test.ts`. Confirm the hook integration tests (`tests/hooks/kk-capture.test.ts`, `tests/hooks/kk-proposal-drain.test.ts`) assert the same behavior. Migrate any single critical assertion that is genuinely uncovered into the hook test, then delete the two lib files. Drop narrow edge cases per the pragmatic rule.
4. For `tests/lib/session-start.test.ts` (the session-start index-injection path): this is a critical path. Trim it to the essential assertions (index pointer injection, ordering, empty-state handling) rather than deleting it. Keep it as the single surviving session-start test.
5. For `tests/lib/session-log.test.ts`: delete only if the surviving session-start test plus `tests/commands/session-log-update-proposals.test.ts` cover its behavior; otherwise keep a trimmed version. When unsure, keep a trimmed version (floor over aggression).
6. Run `npx vitest run`, fix fallout by relocating shared helpers, confirm green, and record deletions for the summary.
</details>

<details>
<summary>Test philosophy (apply verbatim)</summary>

Write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library.

Write tests for: custom business logic and algorithms; critical user workflows and data transformations; edge cases and error conditions for core functionality; integration points between components; complex validation logic.

Do NOT write tests for: third-party library functionality; framework features; simple CRUD without custom logic; trivial getters/setters or static configuration; obvious functionality that would break immediately if incorrect.

Rules: combine related scenarios into a single test; favor integration and critical-path coverage over per-method unit tests; avoid one test per CRUD operation; question whether simple functions need a dedicated test. The hook integration tests are the preferred tier here; the lib unit duplicates of the same pipeline are the redundancy to remove.
</details>
