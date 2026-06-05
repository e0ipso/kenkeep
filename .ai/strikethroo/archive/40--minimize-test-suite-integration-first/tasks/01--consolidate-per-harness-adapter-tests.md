---
id: 1
group: "test-suite-minimization"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - vitest
  - typescript
complexity_score: 7
complexity_notes: "Touches the entire tests/harnesses/ tree plus four adapter-level lib tests; must preserve the four-area per-adapter coverage while collapsing duplication."
---
# Consolidate per-harness adapter tests into parametrized tests

## Objective
Collapse the duplicated per-harness adapter tests (`headless`, `hooks-config`, `transcript`, `list-memory-files`) and their adapter-level `tests/lib/` unit counterparts into a small set of parametrized tests that iterate over the registered harnesses, while preserving the four-area coverage AGENTS.md requires for every adapter. Keep `detect` and `registry` untouched.

## Skills Required
- `vitest`: rewrite suites as parametrized tests using the harness registry.
- `typescript`: keep types and imports correct after consolidation.

## Acceptance Criteria
- [ ] Per-harness copies of `headless`, `hooks-config`, `transcript`, and `list-memory-files` under `tests/harnesses/{claude,codex,copilot,cursor,opencode}/` are removed and replaced by parametrized tests that iterate over the registry.
- [ ] For every registered adapter the parametrized tests still assert: transcript parsing, hook registration round-trip (hooks-config), and headless-run option mapping. (The fourth AGENTS.md area, doctor checks, is covered by the top-level `doctor` suite owned by task 4.)
- [ ] `tests/harnesses/detect.test.ts` and `tests/harnesses/registry.test.ts` are left unchanged.
- [ ] The adapter-level lib unit tests `tests/lib/headless.test.ts`, `tests/lib/hooks-config.test.ts`, `tests/lib/transcript.test.ts`, and `tests/lib/memory-files.test.ts` are deleted (their behavior is now covered by the parametrized adapter tests).
- [ ] `npx vitest run` passes with zero failures after the change.
- [ ] No files outside this task's ownership set are modified; `src/` and `dist/` are untouched.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Test runner is `vitest` (`npx vitest run`). The `claude` subprocess is mocked in the suite; do not require a real binary.
- The harness registry is the source of truth for which adapters exist. Drive the parametrized tests from it (or from an explicit array of the five ids: claude, codex, copilot, cursor, opencode) so adding an adapter later extends coverage automatically.
- Owned files (the ONLY files this task may modify or delete):
  - `tests/harnesses/claude/list-memory-files.test.ts`
  - `tests/harnesses/codex/{headless,hooks-config,list-memory-files,transcript}.test.ts`
  - `tests/harnesses/copilot/{headless,hooks-config,transcript}.test.ts`
  - `tests/harnesses/cursor/{headless,hooks-config,session-id,transcript}.test.ts`
  - `tests/harnesses/opencode/{headless,list-memory-files,transcript}.test.ts`
  - `tests/lib/headless.test.ts`, `tests/lib/hooks-config.test.ts`, `tests/lib/transcript.test.ts`, `tests/lib/memory-files.test.ts`
  - New parametrized files you create under `tests/harnesses/`.
- Do NOT touch `tests/harnesses/detect.test.ts` or `tests/harnesses/registry.test.ts`.

## Input Dependencies
None. This is the first task in the chain.

## Output Artifacts
- A consolidated, parametrized adapter test layout under `tests/harnesses/`.
- A green `vitest run` baseline for the next task in the chain.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Run `npx vitest run` once and confirm the suite is green before changing anything. If it is already red, stop and report.
2. Read the per-harness files listed above and the four adapter-level lib tests. Identify the distinct behaviors actually asserted (transcript parsing of each harness transcript format, hooks-config registration round-trip, headless option mapping, list-memory-files resolution). Most assert the same shape with different fixtures.
3. Create one parametrized test file per behavior (suggested: `tests/harnesses/transcript.test.ts`, `tests/harnesses/headless.test.ts`, `tests/harnesses/hooks-config.test.ts`, `tests/harnesses/list-memory-files.test.ts`). Each uses `it.each` / a loop over the registered harness ids and pulls the per-harness fixture. Keep one representative assertion set per adapter; you may drop redundant near-identical cases per the pragmatic coverage rule.
4. Where an adapter genuinely differs (for example cursor session-id handling, or an adapter that does not implement list-memory-files), keep that difference as a targeted case rather than forcing a uniform shape. Do not silently lose an adapter-specific behavior that no other test covers.
5. Delete the now-redundant per-harness files and the four adapter-level lib tests.
6. Run `npx vitest run`. Fix any breakage caused by removed shared helpers by relocating the helper into `tests/fixtures/` or a `tests/helpers` module rather than restoring a deleted test file.
7. Confirm green and record which files were deleted and which were created for the execution summary.
</details>

<details>
<summary>Test philosophy (apply verbatim)</summary>

Write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library.

Write tests for: custom business logic and algorithms; critical user workflows and data transformations; edge cases and error conditions for core functionality; integration points between components; complex validation logic.

Do NOT write tests for: third-party library functionality; framework features; simple CRUD without custom logic; trivial getters/setters or static configuration; obvious functionality that would break immediately if incorrect.

Rules: combine related scenarios into a single test; favor integration and critical-path coverage over per-method unit tests; avoid one test per CRUD operation; question whether simple functions need a dedicated test. Here, parametrizing across harnesses is the integration-first move: one test, many adapters, instead of five near-identical files.
</details>
