---
id: 3
group: "test-suite-minimization"
dependencies: [2]
status: "completed"
created: 2026-06-05
skills:
  - vitest
  - typescript
complexity_score: 6
complexity_notes: "Applies the keep-set to the remaining lib unit tests and trims command-level redundancy; the keep/delete decision per file is the main judgment."
---
# Prune command-level redundancy and the remaining lib unit layer

## Objective
Keep the `tests/commands/` integration tests as the backbone (trimming only clearly redundant cases) and reduce the remaining `tests/lib/` unit layer to the keep-set of genuinely tricky pure-logic tests, deleting or folding the rest per the pragmatic coverage rule.

## Skills Required
- `vitest`: judge coverage overlap and trim redundant cases.
- `typescript`: keep imports and types valid after deletions.

## Acceptance Criteria
- [ ] All seven `tests/commands/*.test.ts` files remain as integration coverage; only clearly duplicate cases are trimmed (do not drop coverage of any command).
- [ ] The keep-set lib unit tests are retained because no integration test is a good probe for them: `tests/lib/json-extract.test.ts`, `tests/lib/cli-args.test.ts`, `tests/lib/index-gen.test.ts` (determinism contract, AGENTS.md protected), and `tests/lib/nodes.test.ts` (schema and naming rules).
- [ ] The redundant lib unit tests are deleted where a `tests/commands/` test covers the same behavior: `tests/lib/curate.test.ts` (covered by `commands/curate-dedup`), `tests/lib/lint.test.ts` (covered by `commands/lint`), `tests/lib/logs-prune.test.ts` (duplicate of the top-level `logs-prune` test owned by task 4).
- [ ] The remaining lib units (`tests/lib/bootstrap.test.ts`, `tests/lib/state.test.ts`, `tests/lib/lint-state.test.ts`, `tests/lib/hook-diagnostic.test.ts`, `tests/lib/kkignore-stub.test.ts`, `tests/lib/settings.test.ts`) are each either kept as a trimmed single test (if they are the only coverage of a real behavior) or deleted (if covered by an integration test). Decide per file using the rule below and record the decision.
- [ ] `npx vitest run` passes with zero failures.
- [ ] Only files in this task's ownership set are modified; `src/` and `dist/` untouched.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Owned files (the ONLY files this task may modify or delete):
  - `tests/commands/{cli-deprecation,curate-dedup,finddocs,launchers,lint,node-write,session-log-update-proposals}.test.ts`
  - `tests/lib/{curate,lint,bootstrap,state,lint-state,hook-diagnostic,kkignore-stub,logs-prune,index-gen,json-extract,cli-args,nodes,settings}.test.ts`
- The `claude` subprocess is mocked.

## Input Dependencies
- Task 2 completed and the suite green.

## Output Artifacts
- A pruned command and lib layer, green `vitest run`, and a per-file keep/delete decision list for the summary.

## Implementation Notes

<details>
<summary>Decision rule per lib file</summary>

For each candidate lib unit test: (a) if a `tests/commands/`, `tests/hooks/`, `tests/harnesses/`, or top-level integration test already asserts the same behavior, delete the unit test (migrate one critical assertion first only if genuinely uncovered); (b) if the file tests tricky pure logic with no good integration probe (parsing, schema, naming, determinism, deterministic generation), keep it (trim redundant cases); (c) when unsure whether a behavior is covered, keep a trimmed version rather than delete (the integration floor wins over aggression).

Explicit keep-set (do not delete): `json-extract`, `cli-args`, `index-gen`, `nodes`.
Explicit delete (covered elsewhere): `curate`, `lint`, `logs-prune` (lib copy; the top-level copy survives).
Judge per rule: `bootstrap` (keep a trimmed test if it is the only bootstrap coverage), `state`, `lint-state`, `hook-diagnostic`, `kkignore-stub`, `settings` (settings writing may be covered by `init`; if so delete, else keep trimmed).
</details>

<details>
<summary>Step-by-step</summary>

1. Confirm `npx vitest run` is green at start.
2. Apply the decision rule to each owned lib file. Delete or trim accordingly.
3. Trim only clearly duplicate cases inside the `tests/commands/` files; keep every command covered by at least one case.
4. Run `npx vitest run`, fix fallout by relocating shared helpers, confirm green.
5. Record the per-file keep/delete decision and any dropped edge cases for the execution summary.
</details>

<details>
<summary>Test philosophy (apply verbatim)</summary>

Write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library.

Write tests for: custom business logic and algorithms; critical user workflows and data transformations; edge cases and error conditions for core functionality; integration points between components; complex validation logic.

Do NOT write tests for: third-party library functionality; framework features; simple CRUD without custom logic; trivial getters/setters or static configuration; obvious functionality that would break immediately if incorrect.

Rules: combine related scenarios into a single test; favor integration and critical-path coverage over per-method unit tests; avoid one test per CRUD operation; question whether simple functions need a dedicated test. The command-level integration tests are the backbone to keep; lib units that re-test the same command paths are the redundancy to remove. Pure-logic units (parsing, schema, determinism) stay because an integration test is a poor probe for them.
</details>
