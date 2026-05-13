---
id: 5
group: "tests"
dependencies: [2, 3, 4]
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - vitest
---
# Update tests to match the reduced settings, count-based batching, and simplified logs-prune

## Objective

Rewrite the test files that asserted against the removed APIs so the full test suite passes. Add a small unit test for the new `chunk` helper. Do not skip tests; replace assertions to verify the new contracts.

## Skills Required

- `typescript`, `vitest`: edit and add tests under `tests/` and `tests/lib/`.

## Meaningful Test Strategy Guidelines

Mantra: "write a few tests, mostly integration." Tests added or rewritten here verify our code, not the framework. Combine related scenarios. Do not write per-property setter tests.

## Acceptance Criteria

- [ ] `tests/lib/settings.test.ts` no longer fixtures a user-level config file. Tests assert: defaults applied when no project file; project file overrides defaults; missing project file is a no-op; malformed YAML throws an Error whose message names the file; schema violation (e.g. stray `drainBound: 5`) throws an Error whose message includes `drainBound`. No `warnings` assertions remain.
- [ ] `tests/lib/bootstrap.test.ts` removes `chunkDocs` and `tokenBudget` cases. Add or adapt a test asserting that 41 docs produce 3 batches of 20/20/1 via the new `chunk(docs, 20)` path; preserve any existing higher-level bootstrap-flow test by removing token-budget assertions but keeping the flow check.
- [ ] `tests/lib/curate.test.ts` removes `batchSessions` cases. Add or adapt a test asserting that 21 sessions produce 3 batches of 10/10/1 via the new `chunk(sessions, 10)` path; preserve higher-level curate-flow tests by removing `tokenBudget` assertions.
- [ ] New `tests/lib/chunk-batch.test.ts`: one `describe` with focused cases for the `chunk` helper. Cover: empty input → `[]`; exact multiple → equal-size batches; remainder → last batch shorter; `size <= 0` throws.
- [ ] `tests/logs-prune.test.ts` is rewritten: build a temp `_logs/` tree with `proposal/old.jsonl` (mtime 31 days ago), `proposal/new.jsonl` (current mtime), and one nested non-`.jsonl` file. Run `pruneLogs({ logsDir, cutoffMs: now - 30 days })`, assert `{ filesDeleted: 1 }` and that the old file is gone while the new file and the non-jsonl file remain. Drop all bucket/byte/`parseDurationMs`/`formatBytes` cases.
- [ ] `tests/init.test.ts`: the `expect(body['bootstrapTokenBudget']).toBe(10000)` line and any other expectations for removed keys are deleted. New assertions verify the written `config.yaml` contains exactly `schema_version`, `curationThreshold`, `logsRetentionDays`, `lintEveryNSessions`.
- [ ] `tests/upgrade.test.ts`: any `drainBound` fixture that relied on it being a valid key must change (use a retained key like `curationThreshold: 42`). The `body.drainBound` assertion is deleted or rewritten.
- [ ] `tests/doctor.test.ts`: the `'schema_version: 1\ndrainBound: -1\n'` fixture must use a retained key for the negative-value branch (e.g. `'schema_version: 1\ncurationThreshold: -1\n'`). The expected error/warning string updates accordingly.
- [ ] `tests/lib/proposal-drain.test.ts`: tests that pass `maxAttempts: 3` directly to lib functions continue to work; no schema-driven plumbing assertions remain.
- [ ] `npm run test` passes. `npm run lint` passes. `npm run build` passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Use existing test helpers for temp-dir setup (`mkdtempSync(join(tmpdir(), ...))`).
- For file-age tests, use `utimesSync(path, atime, mtime)` to backdate `*.jsonl` files; pass `Date`s as numbers in seconds.

## Input Dependencies

Tasks 2, 3, 4 (all source changes that the tests must align with).

## Output Artifacts

Green `npm run test`, `npm run lint`, `npm run build`.

## Implementation Notes

<details>
<summary>Tips</summary>

- For `settings.test.ts`, the strict-schema error message from Zod includes the key name and the issue list. Assert with `expect(() => resolveSettings(...)).toThrow(/drainBound/)` rather than matching exact wording.
- Do not add a "warnings was removed" test. Tests should describe current behavior, not history.
- For `chunk-batch.test.ts`, keep the file small: 4-5 it() blocks max.
- For `logs-prune.test.ts`, the cutoff comparison is strictly `<` (mtime equal to cutoff is kept). Backdate the old file to >30 days, e.g. 31 days.
- If `tests/lib/curate.test.ts` referenced an internal `batchSize` ctx option that survived from before the rewrite, drop those expectations.

</details>
