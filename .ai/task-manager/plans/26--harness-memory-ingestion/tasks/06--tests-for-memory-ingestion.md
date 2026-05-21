---
id: 6
group: "testing"
dependencies: [3, 4]
status: "pending"
created: 2026-05-21
skills:
  - vitest
  - typescript
---
# Tests covering memory-files helper, per-adapter discovery, and pipeline integrations

## Objective
Lock the memory-ingestion invariants in place with focused tests: unit coverage for the helper's branchy logic, per-adapter coverage for `listMemoryFiles()` (mocked headless child), and integration tests showing `bootstrap-incremental` and `curate` emit ledger-tracked memory candidates and honor the CI guard.

## Skills Required
- vitest (existing test conventions in `tests/`)
- typescript (mocking adapters and child processes)

## Meaningful Test Strategy Guidelines
"Write a few tests, mostly integration."

**Definition of Meaningful Tests:** Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library.

**When TO Write Tests** (in scope here):
- Helper branching: empty list, unchanged-via-ledger, changed file, missing-on-disk, duplicate IRI, secretlint-blocked, secretlint-redacted, malformed-ledger reset.
- Adapter `listMemoryFiles()` parsing: valid JSON array, empty array, non-JSON output, array with non-`file://` entries, child failure path.
- Integration: memory candidates produce nodes in bootstrap; memory candidates appear in curate input; ledger update happens only on success; CI guard still refuses both commands.
- Secretlint redaction: a fake high-entropy token in a memory fixture is `[REDACTED:...]` in the LLM input.

**When NOT to Write Tests** (out of scope here):
- `scanAndRedact` internals (already tested upstream).
- `atomicWriteJson` internals.
- The bootstrap chunker, the curator prompt, or the run lock (existing tests cover them).
- Trivial getters/setters on the candidate types.

## Acceptance Criteria
- [ ] `tests/lib/memory-files.test.ts` covers the helper branches listed above. Use a stubbed `HarnessAdapter` and a temp directory for the ledger path. Aim for one `describe` block, ~8 focused `it` cases.
- [ ] `tests/harnesses/claude/list-memory-files.test.ts` mocks the headless child (via the same mocking pattern used by existing `runHeadlessClaude` tests) and covers: valid JSON IRI array, empty array, malformed JSON → warn + `[]`, mixed entries (some non-`file://` filtered out), duplicate IRIs de-duplicated, `KB_BUILDER_INTERNAL=1` set on child env (assertion).
- [ ] `tests/harnesses/codex/list-memory-files.test.ts` and `tests/harnesses/opencode/list-memory-files.test.ts` each assert the method returns `[]` and does not spawn a child process. (One `it` each is enough.)
- [ ] An integration test (under `tests/commands/` or `tests/lib/`) shows `runBootstrapIncremental` with a `memoryCandidates` argument produces at least one node candidate alongside markdown candidates, with collision-skip behaviour preserved when the synthetic `memory://` path collides with an existing node file. Stub the LLM call (existing test pattern).
- [ ] An integration test for `curate` shows memory candidates appear in the curator's input set with `source: 'harness-memory'` provenance and the ledger is updated only when the curate run reports success (separate `it` for success vs. failure paths).
- [ ] A regression test confirms `bootstrap-incremental` and `curate` still refuse to run in CI (`CI=true` or whatever signal the existing CI guard inspects) with memory ingestion in the pipeline. Reuse the existing CI-guard test pattern; do not invent a new env variable.
- [ ] A secretlint regression: a fixture memory file containing a synthetic high-entropy token (reuse a token from `tests/fixtures/`) yields `[REDACTED:...]` content in the candidate passed downstream.
- [ ] `npm test` passes locally with zero new flaky tests.

## Technical Requirements
- Vitest + the existing helpers in `tests/helpers.ts`.
- Use temp directories via the project's existing temp-dir helper (whatever `tests/init.test.ts` uses).
- Mock child processes the way Claude headless tests already do — do not spawn real `claude`/`codex`/`opencode` binaries.

## Input Dependencies
- Tasks 3 and 4 — both pipeline integrations are in place.

## Output Artifacts
- New test files under `tests/lib/`, `tests/harnesses/{claude,codex,opencode}/`, and `tests/commands/` (or wherever the existing integration tests live).
- Possibly small fixture files under `tests/fixtures/memory/`.

## Implementation Notes

<details>
<summary>Patterns and pitfalls</summary>

- For the helper tests, construct a stub adapter inline: `{ listMemoryFiles: async () => [...iris], /* other required methods can throw — they are not invoked */ } as unknown as HarnessAdapter`. If TypeScript complains, build a `makeStubAdapter` helper that returns a `Partial<HarnessAdapter>` typed as `HarnessAdapter`.
- Drive the ledger by pre-writing a JSON file at `paths.memoryLedgerFile` before the test. Use `atomicWriteJson` directly so the test exercises the same write path.
- For "secretlint blocked" vs "redacted", reuse fixtures from existing `secret-scan` tests rather than crafting new ones.
- For the bootstrap integration test, stub `discoverMarkdownFiles` and the LLM bootstrap call using whatever DI hook `runBootstrapIncremental` already accepts (check `bootstrap.ts` exports — there's likely an injectable `runHeadless` or test seam). Avoid running a real LLM.
- For the curate integration test, mirror the existing curate test patterns. Confirm provenance flows through to the curator's input envelope.
- CI guard test: just one `it` per command that sets the CI env signal and asserts the command refuses.
- Keep total test count tight — combine related assertions into single `it` blocks where reasonable. Target ~15 new `it` cases total across all files.
</details>
