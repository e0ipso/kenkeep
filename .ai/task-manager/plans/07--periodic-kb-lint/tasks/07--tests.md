---
id: 7
group: "testing"
dependencies: [1, 2, 3, 4, 5, 6]
status: "completed"
created: 2026-05-13
skills:
  - vitest
  - typescript
---
# Tests for the lint pipeline

## Objective

Add focused Vitest coverage for the new lint surface: the four checks (with positive and negative fixtures), the CLI exit code, the state file read/write tolerance, the SessionEnd tick increment-and-fire behavior, the SessionStart nudge appending, the init/doctor wiring, and the perf budget on a synthetic 1000-node KB.

Follows the project mantra: a few tests, mostly integration. Combine related scenarios; do not write one test per CRUD operation.

## Skills Required

- vitest: test authoring with the existing `makeSandbox` / `runCli` / `cleanSandbox` helpers.
- typescript: writing fixture node files via `matter.stringify`.

## Acceptance Criteria

- [ ] New test file `tests/lib/lint.test.ts` covers `runLint` directly with synthetic node fixtures written to a temp dir. At minimum:
  - A clean tree returns `{ errors: [], findings: [] }`.
  - A single test creates one node per rule violation (one dangling edge, one slug/id mismatch, one tag near-duplicate, one orphan) and asserts the result contains exactly those entries with the expected `rule` and `file` values. The four checks are exercised in one fixture; do NOT create four separate test files.
  - A perf assertion: build a 1000-node fixture (cheap loop emitting `nodes/practice/practice-N.md`), call `runLint`, assert wall-clock under 200 ms (matches success criterion §5). Skip on CI variance by giving a generous `200 ms` ceiling; investigate if it fails.
- [ ] New test file `tests/lib/lint-state.test.ts` covers:
  - `readLintState` returns `DEFAULT_LINT_STATE` for missing, malformed JSON, and schema-failing inputs.
  - `writeLintState` writes a valid JSON file that `readLintState` round-trips.
  - One combined test, not three.
- [ ] New test file `tests/commands/lint.test.ts` covers the CLI as an integration test via `runCli`:
  - Empty `nodesDir` returns exit `0`.
  - A nodes tree with a dangling edge returns exit `1` and the verbose output names the offending file.
  - Tag-near-duplicate alone (no errors) returns exit `0` and prints the finding under `--verbose`.
- [ ] New test file `tests/hooks/kb-lint-tick.test.ts` covers the SessionEnd hook by invoking the compiled `.mjs` directly with empty stdin (the harness pattern used by other hook tests; if no such pattern exists yet, invoke `node dist/hooks/kb-lint-tick.mjs` from a sandbox after seeding `installedVersionFile`):
  - With `lintEveryNSessions: 1` and a tree containing an orphan: one invocation creates `.state/lint-state.json` with `last_findings: 1, sessions_since_last_lint: 0`.
  - With `lintEveryNSessions: 3` and a clean tree: three invocations are needed for the run to fire; verify intermediate state shows the counter incrementing and `last_lint_at: null`, then the third invocation resets the counter and stamps `last_lint_at`.
  - One file for both scenarios; share a sandbox helper.
- [ ] Extend `tests/lib/session-start.test.ts`:
  - A new test asserts that when `lintStateFile` points at a JSON with `last_errors: 0, last_findings: 0`, no lint line appears.
  - A second test asserts that when `last_errors: 2, last_findings: 1`, the additionalContext includes a line matching `/Last KB lint .* 2 error\(s\), 1 finding\(s\)/` and `lintNudged === true`.
- [ ] Extend `tests/init.test.ts` (or add a new `tests/init-lint-hook.test.ts` if cleaner):
  - After `ai-knowledge-base init --assistants claude`, `.claude/settings.json` contains BOTH the `SessionEnd → kb-capture.mjs` entry and the `SessionEnd → kb-lint-tick.mjs` entry, and `.claude/hooks/kb-lint-tick.mjs` exists.
  - After a simulated upgrade (call `installClaude` twice, the second time after pre-populating an old-shape settings.json), both SessionEnd entries are present, no duplicates.
- [ ] Extend `tests/doctor.test.ts`:
  - When `.claude/hooks/kb-lint-tick.mjs` is missing or the settings registration is missing, the doctor `claude hooks` check reports the missing entry with severity `error`.
- [ ] All new tests pass via `npm test`. Existing tests continue to pass.

Use your internal Todo tool to track these and keep on track.

## Meaningful Test Strategy Guidelines

Your critical mantra for test generation is: "write a few tests, mostly integration".

**Definition of "Meaningful Tests":**
Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms (the four lint checks, the tick-increment-and-fire counter, the nudge text rendering).
- Critical user workflows and data transformations (lint CLI exit codes, lint-state round-trip).
- Edge cases and error conditions for core functionality (malformed JSON in lint-state, orphans in a small KB).
- Integration points (init wiring writes both SessionEnd entries; doctor surfaces the missing-script case).
- Complex validation logic or calculations (counter modulo threshold; perf budget on 1000 nodes).

**When NOT to Write Tests:**
- Third-party library functionality (zod parsing, gray-matter, commander parsing).
- Framework features.
- Simple CRUD without custom logic.
- Getter/setter or pure property access.
- Configuration files or static data.

**Test Task Creation Rules:**
- Combine related test scenarios into single tasks.
- Focus on integration and critical path testing over exhaustive unit coverage.
- Avoid creating separate tasks for testing each rule individually; the four checks live in one fixture.

## Technical Requirements

- Framework: Vitest. Existing helpers: `tests/helpers.ts` exports `makeSandbox`, `cleanSandbox`, `seedPackageJson`, `runCli`, `cliPath`, `repoRoot`.
- Fixture pattern: build a temp dir, write node files via `matter.stringify(body, frontmatter)`. See `tests/doctor-dangling.test.ts` `writeNode` helper for a working reference. Note that the schema after plan 06 no longer has `valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`; do NOT include those in test fixtures or the frontmatter validation will reject them under `.strict()` mode (if applicable).
- For the perf test: `vi.setConfig({ testTimeout: 5000 })` is plenty; use `performance.now()` deltas.
- For the hook test that spawns the compiled `.mjs`: ensure `npm run build` has produced `dist/hooks/kb-lint-tick.mjs` before tests run. The `pretest` script already runs the build.

## Input Dependencies

- Tasks 1-6 must be complete (the test file imports their exports and asserts their behavior).

## Output Artifacts

- New test files under `tests/lib/`, `tests/commands/`, `tests/hooks/`.
- Edits to existing `tests/lib/session-start.test.ts`, `tests/init.test.ts`, and `tests/doctor.test.ts`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Start with the smallest test: `tests/lib/lint-state.test.ts`. Cover missing-file, malformed-JSON, schema-violation, and round-trip in one `describe` block. ~30 lines.

2. Write `tests/lib/lint.test.ts`. Helper `writeNode(dir, id, frontmatter)` that takes a partial frontmatter and fills in the survivors of plan 06's schema: `schema_version: 1`, `id`, `title: id`, `kind: 'practice'`, `tags: []`, `derived_from: []`, `relates_to: []`, `depends_on: []`, `confidence: 'high'`, `summary: 's'`. Test cases:
   - Clean tree (1-2 nodes with matching ids and bidirectional `relates_to`): expect empty arrays.
   - Combined-failure tree: one node with `relates_to: ['nonexistent-id']` (dangling edge), one node whose `id` is `practice-NotASlug` with filename `practice-NotASlug.md` (mismatch, since the slug should be `practice-notaslug` or whatever `slugify('NotASlug')` returns), one orphan node (no in/out edges and not referenced by anyone), and two nodes tagged `hooks` and `hook` to trigger the near-duplicate cluster. Assert the result's rule counts match.
   - Perf: a setup loop creating 1000 valid linked-pair nodes; assert `runLint` returns within 200 ms via `performance.now()`. Use `vi.skip()` if running in a known-slow environment.

3. Write `tests/commands/lint.test.ts`. Use `makeSandbox` + `runCli(sandbox, ['lint'])`. Seed `.ai/knowledge-base/nodes/practice/...` with fixtures. Assertions on exitCode and stdout substring.

4. Write `tests/hooks/kb-lint-tick.test.ts`. To invoke the hook directly:

   ```ts
   import { execFile } from 'node:child_process';
   import { promisify } from 'node:util';
   import { join } from 'node:path';
   const exec = promisify(execFile);
   const hookPath = join(repoRoot, 'dist/hooks/kb-lint-tick.mjs');
   await exec('node', [hookPath], { cwd: sandbox, input: '' });
   ```

   Before running, seed: a `package.json`, `.ai/knowledge-base/.state/installed-version` file, a `config.yaml` with `lintEveryNSessions: 1` (or `: 3`), and the nodes tree.

5. Extend `tests/lib/session-start.test.ts`. The existing tests pass a `SessionStartContext` directly; add the new `lintStateFile` field to two new `it()` blocks.

6. Extend `tests/init.test.ts`. After the existing `init` invocation, parse `.claude/settings.json` and assert both `SessionEnd` entries are present. For the upgrade test, pre-write a partial settings.json missing the lint-tick entry, run `installClaude` (or `runCli(['init', '--assistants', 'claude', '--upgrade'])`), and re-assert.

7. Extend `tests/doctor.test.ts`. Add a case where `.claude/hooks/kb-lint-tick.mjs` is deleted between init and doctor; assert the `claude hooks` check reports a missing-script error.

8. Run `npm test` and confirm all tests pass. If the perf test fails on CI, widen the ceiling (300-400 ms) rather than disabling it.

</details>
