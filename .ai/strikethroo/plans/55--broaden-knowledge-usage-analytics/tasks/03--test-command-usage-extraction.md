---
id: 3
group: "verification"
dependencies: [2]
status: "pending"
created: 2026-06-20
skills:
  - vitest
  - usage-tracking
complexity_score: 5
complexity_notes: "Combines focused extractor, usage classification, and spawned capture-hook coverage without creating redundant shell parser tests."
---
# Test Command Usage Extraction

## Objective
Add focused Vitest coverage proving shell/search command extraction works across supported harnesses, resolves supported relative knowledge-base candidates deterministically, and reaches `usage.jsonl` through the compiled capture hooks.

## Skills Required
Requires `vitest` and `usage-tracking` skills to verify extractor behavior, `classifyRead`, and monotonic duplicate-preserving ledger reconciliation.

## Acceptance Criteria
- [ ] `tests/harnesses/read-extract.test.ts` covers shell/search command extraction for every harness where command text is visible in captured source.
- [ ] Tests prove dedicated read-tool extraction remains unchanged, read and command candidates keep transcript/export order, and duplicate command-path candidates are preserved.
- [ ] Tests cover malformed command inputs, non-node markdown candidates, directory-only search candidates, and glob-like candidates producing no usage records and no thrown errors.
- [ ] `tests/lib/usage.test.ts` or equivalent focused coverage proves command-extracted absolute paths, `.ai/kenkeep/nodes/...` paths, and `nodes/...` paths classify and reconcile into the existing `{ document, type, session_id, used_at }` record shape.
- [ ] `tests/hooks/kk-capture.test.ts` includes spawned hook coverage proving command-derived reads reach `.ai/kenkeep/.state/usage.jsonl` for each supported harness, or documents any harness-specific unsupported command shape in the test name and plan risk.
- [ ] Focused test commands pass for `tests/harnesses/read-extract.test.ts`, `tests/lib/usage.test.ts`, and the relevant `tests/hooks/kk-capture.test.ts` cases.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use the existing Vitest test style and local temp-directory fixture patterns. Avoid requiring real harness binaries; tests must remain hermetic. Spawned hook tests use built `dist/hooks/...` files, so run them through `npm test` or rebuild first with `npm run build`.

## Input Dependencies
Depends on Task 2's per-harness extractor wiring.

## Output Artifacts
- Updated extractor tests in `tests/harnesses/read-extract.test.ts`.
- Updated usage tests in `tests/lib/usage.test.ts` or another existing focused usage test file.
- Updated spawned capture-hook coverage in `tests/hooks/kk-capture.test.ts`.
- Passing focused Vitest runs for the changed test files, plus `npm run typecheck`.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Test philosophy: "write a few tests, mostly integration". Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. Write tests for custom business logic and integration points between components. Do not write tests for third-party library functionality, framework features, trivial getters/setters, or static configuration. Combine related scenarios into a single task, favor integration and critical-path coverage over per-method unit tests, and question whether simple functions need a dedicated test.

Keep the test surface compact:

- In `tests/harnesses/read-extract.test.ts`, add one command-string case per harness extractor, preferably extending the existing describe blocks.
- Include at least one duplicate command read assertion, because duplicate preservation is part of the product behavior.
- Include malformed JSON or malformed export shapes where the extractor already has defensive tests, but do not create exhaustive shell parser tests.
- In usage integration coverage, feed command-extracted paths into `classifyRead` and `reconcileUsage` to confirm only node markdown files produce ledger records and each JSON line still satisfies `UsageRecordSchema`.
- In spawned hook coverage, seed a real `.ai/kenkeep/nodes/.../*.md` file, use fixture transcript/export data with a command-derived read of that file, run the compiled hook, and assert the usage ledger exists with the expected document id. Reuse the current harness parametrization where possible.

Run focused validation first:

```sh
npm test -- tests/harnesses/read-extract.test.ts tests/lib/usage.test.ts tests/hooks/kk-capture.test.ts
```

Then run TypeScript and the broader suite because the implementation touches shared capture behavior:

```sh
npm run typecheck
npm test
```
</details>
