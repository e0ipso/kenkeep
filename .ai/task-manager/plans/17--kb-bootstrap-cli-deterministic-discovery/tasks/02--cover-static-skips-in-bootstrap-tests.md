---
id: 2
group: "deterministic-discovery"
dependencies: [1]
status: "pending"
created: 2026-05-13
skills:
  - vitest
---
# Extend `tests/lib/bootstrap.test.ts` with STATIC_SKIPS coverage

## Objective

Add direct unit coverage to `tests/lib/bootstrap.test.ts` that proves the new `STATIC_SKIPS` rules in `discoverMarkdownFiles` behave correctly: each pattern category is rejected by default, an explicit `--include` overrides a static skip, `--exclude` still wins over an explicit include, `.gitignore` is still honored, and adjacent files that merely share a prefix (e.g. `CHANGELOG_FORMAT.md`) are not falsely filtered.

## Skills Required

- `vitest` — extending an existing vitest suite (`describe`/`it`, in-memory or tmpdir filesystem harness) without changing unrelated tests.

## Acceptance Criteria

- [ ] New `it(...)` cases are added under the existing `describe('discoverMarkdownFiles', …)` block in `tests/lib/bootstrap.test.ts`.
- [ ] One case proves the default deny: each STATIC_SKIPS category (LICENSE, COPYING, NOTICE, CODE_OF_CONDUCT, CONTRIBUTORS/AUTHORS/MAINTAINERS, CHANGELOG/CHANGES/HISTORY/RELEASE_NOTES, `releases/**/*.md`, `INDEX.md`, `GRAPH.md`) is rejected when no `--include` is set.
- [ ] One case proves the override: `--include` of a literal statically-skipped path admits the file.
- [ ] One case proves precedence: a statically-skipped path matched by an explicit `--include` but also matched by `--exclude` is still rejected.
- [ ] One case proves precedence: a statically-skipped path matched by an explicit `--include` but also matched by `.gitignore` is still rejected.
- [ ] One case proves anchoring: similarly-named docs that should *not* be filtered (e.g. `CHANGELOG_FORMAT.md`, `LICENSE_HEADER.md`, `licensing-policy.md`) are *not* filtered out.
- [ ] `pnpm test tests/lib/bootstrap.test.ts` (or the project's equivalent) exits zero with all new cases passing.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `tests/lib/bootstrap.test.ts`.
- Reuse the same harness pattern the existing `discoverMarkdownFiles` tests use (look at the cases at `tests/lib/bootstrap.test.ts:153, :162, :175`) — do not introduce a new fs-mocking library.
- Tests must operate on real files in a tmpdir, not on string fixtures, since `discoverMarkdownFiles` performs an actual recursive walk.
- Import `STATIC_SKIPS` from `src/lib/bootstrap` *only if* an assertion needs to reference the pattern list by name; otherwise hand-write the expected behaviour.

## Input Dependencies

- Task 1: the `STATIC_SKIPS` constant and updated `discoverMarkdownFiles` filter chain must exist before this task can run.

## Output Artifacts

- A passing vitest suite that future maintainers can rely on to detect regressions in the static-skip filter, the override semantics, or filter precedence.

## Implementation Notes

<details>

Meaningful-test reminder ("write a few tests, mostly integration; focus on YOUR custom logic, not framework functionality"): every assertion here checks logic *we* wrote — pattern anchoring, override semantics, precedence ordering. Do not add tests for the `walk` recursion, `readdirSync` behaviour, or vitest framework features.

Test layout suggestion (one file change, ~5-6 new `it(...)` cases under the existing `describe('discoverMarkdownFiles', …)`):

1. `it('skips static deny patterns by default')` — create the docs tree with one file per category (LICENSE.md, COPYING, CODE_OF_CONDUCT.md, CONTRIBUTORS.md, AUTHORS.md, MAINTAINERS.md, CHANGELOG.md, CHANGES.md, HISTORY.md, RELEASE_NOTES.md, releases/v1.md, INDEX.md, GRAPH.md), plus one normal `docs/intro.md`. Call `discoverMarkdownFiles({ sourceDir, repoRoot })`. Expect the result to be exactly `['docs/intro.md']` (paths posix, sorted).
2. `it('admits a statically-skipped path when --include matches it explicitly')` — same tree, call with `include: ['LICENSE.md']`. Expect `LICENSE.md` in the result. Expect other statically-skipped files (e.g. CHANGELOG.md) still absent.
3. `it('exclude still wins when --include opts a statically-skipped path in')` — tree with `legacy/LICENSE.md` and `docs/intro.md`. Call with `include: ['legacy/LICENSE.md']` *and* `exclude: ['legacy/**']`. Expect `legacy/LICENSE.md` absent.
4. `it('gitignore still wins when --include opts a statically-skipped path in')` — tree with `LICENSE.md` and `docs/intro.md`. Call with `include: ['LICENSE.md']` and `gitignorePatterns: ['**/LICENSE.md']` (the parsed form that `parseGitignore` would produce). Expect `LICENSE.md` absent.
5. `it('does not filter files that only share a prefix with a static skip')` — tree containing `docs/CHANGELOG_FORMAT.md`, `docs/LICENSE_HEADER.md`, `docs/licensing-policy.md`. Call with no include/exclude. Expect all three present.

Each case can use the small tmpdir harness already present in the file (look at the `beforeEach`/`afterEach` near line 148 and the helper that writes `harness.sourceDir`). If the harness is keyed to a fixed file set, prefer per-test fs setup (write files explicitly inside the `it(...)`) over mutating the shared harness, so cases stay independent.

If a test reveals an off-by-one in the patterns chosen in Task 1 (e.g. `CHANGELOG_FORMAT.md` is being filtered because the pattern was too loose), fix the pattern in `src/lib/bootstrap.ts` rather than weakening the test. The acceptance criterion is the behaviour, not the literal pattern list.

</details>
