---
id: 4
group: "testing"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-07-07
skills:
  - vitest
  - typescript
---
# Tests for Per-Harness View and Hygiene Findings Across Five Harnesses

## Objective
Prove the new diagnostics across all five harnesses (`claude`, `codex`,
`copilot`, `cursor`, `opencode`) without regressing existing checks, using the
established vitest sandbox helpers and the build-first test setup. Cover the
per-harness status block, detection-status rendering, kk-hooks/hooks placement,
the two hygiene findings (in both `lint` and `doctor`), non-blocking exit codes,
single-report dangling reuse, and graceful degradation on malformed nodes.

## Skills Required
- **vitest**: extend `tests/doctor.test.ts`, `tests/doctor-dangling.test.ts`,
  and the lint tests with parametrized cases.
- **typescript**: sandbox helpers, assertions on combined stdout+stderr.

## Acceptance Criteria
- [ ] Parametrized (`it.each(['claude','codex','copilot','cursor','opencode'])`)
      test asserts a per-harness block appears for each installed harness with
      correct present/absent + expected-path text.
- [ ] Detection status asserts "no detector / n/a" for `codex`/`copilot`/
      `opencode` and a truthful value for `claude`/`cursor`; asserts it is not
      emitted at error level and does not affect exit code.
- [ ] kk-hooks/hooks placement text asserted correct for `copilot`/`opencode` vs
      the others.
- [ ] Tag stray-whitespace and empty-summary findings assert file + one-line fix
      appear in `lint` output AND are surfaced by `doctor`, and that they do not
      change exit code (non-blocking).
- [ ] A clean KB asserts zero false hygiene findings; a deliberately dangling
      `kk_derived_from` asserts it is reported exactly once (no duplicate line).
- [ ] A malformed-node / old-layout case asserts doctor reports the migrate/fix
      pointer and skips node-dependent hygiene gracefully (no crash).
- [ ] **Verification:** `npm test` (or `npx vitest run`) passes — `pretest` runs
      `npm run build`, so tests exercise the compiled `dist/cli.js`. Assertions
      match substrings in combined stdout+stderr, consistent with the suite.

## Technical Requirements
- Files: `tests/doctor.test.ts`, `tests/doctor-dangling.test.ts`, and the
  existing lint test file(s).
- Helpers: `makeSandbox`, `cleanSandbox`, `runCli`, `writeHarnessBinaryStubs`
  (locate their module in the existing test suite and reuse as-is).
- Assertions on substrings of combined stdout+stderr (no `strip-ansi`; keep
  matched payloads plain).
- No test may depend on un-built source; rely on `pretest` → `npm run build`.

## Input Dependencies
- Task 1 (per-harness view), task 2 (lint rules), task 3 (doctor surfacing) —
  all three behaviors under test must exist first.

## Output Artifacts
- Passing vitest coverage for all new diagnostics across five harnesses.

## Implementation Notes
**Test philosophy (from the plan — apply verbatim):** *Write a few tests, mostly
integration. Meaningful tests verify custom business logic, critical paths, and
edge cases specific to this application — test your code, not the framework or
library. When TO write tests: custom business logic, critical workflows/data
transformations, edge cases and error conditions for core functionality,
integration points, complex validation. When NOT to: third-party/framework
features, simple CRUD without custom logic, trivial getters/setters/static
config, obvious functionality that would break immediately if incorrect. Combine
related scenarios into a single task/test (e.g. one "hygiene findings" test, not
one per rule); favor integration and critical-path coverage over per-method unit
tests; avoid one test task per operation; question whether simple functions need
a dedicated test.*

<details>
<summary>Step-by-step implementation</summary>

1. Reuse the existing sandbox pattern: `makeSandbox` to build a scratch repo,
   `writeHarnessBinaryStubs` so harness CLIs "exist" on PATH, install harnesses
   (via the helper or by writing the `installed-version` marker the suite uses),
   then `runCli(['doctor', '-v'])` and assert on the returned combined output.
2. Per-harness block test: `it.each([...five ids])`; for each, install that
   harness and assert its block header substring plus hooks/skills present-or-
   absent lines with expected paths.
3. Detection test: assert `codex`/`copilot`/`opencode` show the "no detector /
   n/a" substring; assert exit code unchanged and no error-level marker on the
   detection line.
4. Placement test: assert copilot/opencode kk-hooks placement text differs
   appropriately from claude/codex/cursor.
5. Hygiene tests: in a scratch KB, write a leaf node with a whitespace-laden tag
   and a folder `index.md` with an empty `summary`. Run `lint` and assert two
   findings with file + fix; run `doctor -v` and assert the same two are
   surfaced. Assert lint exit code is 0 (findings-only) and doctor exit code is 0.
6. Clean-KB test: assert no hygiene findings. Dangling test (extend
   `doctor-dangling.test.ts`): assert the dangling line appears exactly once
   (e.g. count occurrences === 1).
7. Malformed-node test: write an invalid-frontmatter node; assert doctor prints
   the migrate/fix pointer and does not throw, and hygiene surfacing is skipped.
8. Run `npm test`; fix assertions only where output legitimately changed shape
   from tasks 1–3 (no BC flag required per plan clarification #5).
</details>
