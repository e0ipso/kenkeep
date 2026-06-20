---
id: 5
group: "session-knowledge-extraction"
dependencies: [1, 2, 3, 6]
status: "completed"
created: 2026-06-20
skills:
  - vitest
  - integration-tests
complexity_score: 7
complexity_notes: "Validates the new path across CLI primitives, scoped dedup stamping, capture preservation, strict proposal schema, shared skill installation, and existing curation regressions after the implementation tasks land."
---
# Add live extraction regression coverage

## Objective
Add focused regression coverage proving the live extraction path works through its deterministic boundaries and does not regress existing capture, proposal drain, or curation behavior.

## Skills Required
- `vitest` - add and maintain repository-style tests for command, library, install, and launcher behavior.
- `integration-tests` - cover cross-component contracts without relying on a real harness binary.

## Acceptance Criteria
- [ ] Tests cover the `session-log stage-live` primitive for valid proposals, empty valid proposals, invalid schema, and update-by-session-id behavior.
- [ ] Tests prove legacy `supports_existing_node` / `contradicts_existing_node` proposal fields are rejected by live staging.
- [ ] Tests cover fallback generated UUID-v4 output and private-span stripping for staged live transcript/evidence text.
- [ ] Tests cover scoped `curate-dedup` stamping: when one unrelated done log and one staged live done log exist, the live path stamps only the staged log.
- [ ] Tests cover capture preservation of processed logs and ordinary refresh behavior for unprocessed logs.
- [ ] Tests cover install/upgrade/doctor expectations for `kk-session-extract` across shared skill locations, with harness binaries mocked as existing tests require.
- [ ] Tests or fixture checks cover the skill's empty/gate-rejected path, prompt-placeholder substitution requirement, `_sessions` path usage, and successful path at the instruction/contract level without requiring a live LLM.
- [ ] Existing curation tests still pass, including `curate-dedup`, proposal update, index rebuild, and rebalance-related coverage touched by the new workflow.
- [ ] `npm test`, `npm run typecheck`, and `npm run lint` pass after the implementation and docs changes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Prefer extending existing test files where they already own the behavior, such as command tests for `session-log`, capture tests, init/upgrade/doctor tests, and launcher tests.
- Do not require a real harness binary; tests must keep using the existing mocked execution pattern.
- Avoid testing third-party YAML, Commander, or framework behavior directly. Assert kenkeep's contracts.
- Inside this source repo, direct CLI invocations should use the built local CLI path (`node dist/cli.js` through the existing test helpers), not `npx kenkeep`.

## Input Dependencies
- Task 1: staging primitive implementation.
- Task 2: capture preservation implementation.
- Task 3: shipped skill and install/launcher surfaces.
- Task 6: scoped `curate-dedup` session-stamping behavior.

## Output Artifacts
- Regression tests spanning the live extraction path and unchanged deferred curation path.
- Passing test, typecheck, and lint runs.

## Implementation Notes
Use this task to close coverage gaps after the implementation tasks, not to duplicate every assertion already covered in Tasks 1 through 3.

<details>
<summary>Detailed implementation guidance</summary>

Test philosophy: Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. Write tests for custom business logic and algorithms, critical user workflows and data transformations, edge cases and error conditions for core functionality, integration points between components, and complex validation logic or calculations. Do not write tests for third-party library functionality, framework features, simple CRUD operations without custom logic, trivial getters/setters or static configuration, or obvious functionality that would break immediately if incorrect. Combine related test scenarios into a single task, favor integration and critical-path coverage over per-method unit tests, and question whether simple functions need a dedicated test.

1. Start by running the relevant existing tests to see the current organization:
   - `tests/commands/session-log-update-proposals.test.ts`
   - capture tests or the closest current capture coverage
   - `tests/init.test.ts`, `tests/upgrade.test.ts`, `tests/doctor.test.ts`, and `tests/commands/launchers.test.ts`
2. Add stage-live assertions that inspect frontmatter fields and proposals rather than only checking exit codes.
3. Add `curate-dedup` assertions for the scoped stamping option. Keep the default all-done-log behavior covered so `/kk-curate` does not regress.
4. Add capture tests with controlled `now()` values and temporary transcript fixtures so hashes and timestamps are deterministic.
5. Add install/doctor assertions by updating the central expected skill list tests instead of per-adapter one-off checks where possible.
6. For the skill instruction contract, prefer snapshot-like or targeted text assertions for required steps: prompt override fallback, prompt placeholder substitution, empty-output no-write path, `session-log stage-live`, scoped `curate-dedup`, `_sessions` path, and rebalance final phase.
7. Run `npm test`, `npm run typecheck`, and `npm run lint`. Fix real regressions; do not add production test-only branches.

</details>
