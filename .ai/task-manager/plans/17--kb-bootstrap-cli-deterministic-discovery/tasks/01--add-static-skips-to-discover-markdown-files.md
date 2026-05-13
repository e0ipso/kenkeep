---
id: 1
group: "deterministic-discovery"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - typescript
---
# Add STATIC_SKIPS constant and apply it inside `discoverMarkdownFiles`

## Objective

Centralise name-pattern rejection of files that are categorically not project knowledge by adding an exported `STATIC_SKIPS` constant to `src/lib/bootstrap.ts` and wiring it into `discoverMarkdownFiles` so every consumer of discovery (CLI run, dry-run listing, future scripted callers) benefits without re-encoding the rule.

## Skills Required

- `typescript` — extending `src/lib/bootstrap.ts` (glob matching, filter ordering, exported API surface).

## Acceptance Criteria

- [ ] A new `STATIC_SKIPS: readonly string[]` (or `string[]`) constant is `export`ed from `src/lib/bootstrap.ts`.
- [ ] `STATIC_SKIPS` covers (at minimum) every category listed in the plan: `LICENSE*`, `COPYING*`, `NOTICE*`, `CODE_OF_CONDUCT*`, `CONTRIBUTORS*`, `AUTHORS*`, `MAINTAINERS*`, `CHANGELOG*`, `CHANGES*`, `HISTORY*`, `RELEASE_NOTES*`, `releases/**/*.md`, `INDEX.md`, `GRAPH.md`.
- [ ] Patterns are anchored so they only match the intended files (e.g. `CHANGELOG.md` and `CHANGELOG`, not `CHANGELOG_FORMAT.md`).
- [ ] `discoverMarkdownFiles` applies `STATIC_SKIPS` after the `.git` / `node_modules` directory prune but before the existing `--include` / `--exclude` / `.gitignore` filters.
- [ ] A path matching `STATIC_SKIPS` is admitted iff at least one explicit `--include` pattern matches it (override semantics).
- [ ] After the override, `--exclude` and `.gitignore` rules continue to apply (existing precedence preserved): an explicitly-included LICENSE excluded by `--exclude '**/legacy/**'` is still rejected.
- [ ] No other behaviour of `discoverMarkdownFiles` changes (sorting, posix-relative paths, recursion, return type).
- [ ] `pnpm typecheck` (or the project's equivalent) exits zero.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `src/lib/bootstrap.ts`.
- Reuse the existing `globMatch` helper (defined around `src/lib/bootstrap.ts:159`) for pattern matching. Do not introduce a second glob engine.
- Patterns follow the same posix-glob dialect already supported by `globMatch` (`**`, `*`, `?`). Use the `**/` prefix convention to match at any depth where appropriate (e.g. `**/LICENSE.md`, `**/CHANGELOG`).
- Filter ordering inside the `.filter(rel => …)` chain of `discoverMarkdownFiles` (around `src/lib/bootstrap.ts:253-260`):
  1. Static-skip pass: if `rel` matches any `STATIC_SKIPS` pattern, drop it unless the caller passed at least one `--include` pattern that also matches `rel`.
  2. `--exclude` pass (unchanged).
  3. `.gitignore` pass (unchanged).
  4. `--include` admission filter (unchanged: if `includes.length > 0`, at least one must match).
- The override-only-when-explicit semantics means: if `includes` is empty, every static-skip pattern wins. If `includes` has entries, a static-skip path is admitted only when at least one of those `--include` entries matches it; otherwise it is still dropped.

## Input Dependencies

None.

## Output Artifacts

- An exported `STATIC_SKIPS` symbol from `src/lib/bootstrap.ts` that tests, the prompt template comments, and any future caller can reference by name.
- Updated `discoverMarkdownFiles` semantics consumed by Task 2 (tests), Task 3 (skill rewrite that relies on the CLI dry-run already filtering these files), and the existing `runBootstrapIncremental` pipeline.

## Implementation Notes

<details>

Concrete patterns to include (anchor them so they only catch the intended files):

```ts
export const STATIC_SKIPS: readonly string[] = [
  '**/LICENSE',
  '**/LICENSE.md',
  '**/LICENSE.txt',
  '**/COPYING',
  '**/COPYING.md',
  '**/NOTICE',
  '**/NOTICE.md',
  '**/CODE_OF_CONDUCT',
  '**/CODE_OF_CONDUCT.md',
  '**/CONTRIBUTORS',
  '**/CONTRIBUTORS.md',
  '**/AUTHORS',
  '**/AUTHORS.md',
  '**/MAINTAINERS',
  '**/MAINTAINERS.md',
  '**/CHANGELOG',
  '**/CHANGELOG.md',
  '**/CHANGES',
  '**/CHANGES.md',
  '**/HISTORY',
  '**/HISTORY.md',
  '**/RELEASE_NOTES',
  '**/RELEASE_NOTES.md',
  '**/releases/**/*.md',
  '**/INDEX.md',
  '**/GRAPH.md',
];
```

Use literal-suffix patterns (e.g. `CHANGELOG.md`, not `CHANGELOG*`) so that `CHANGELOG_FORMAT.md` is *not* filtered out. The existing `globMatch` does not support character classes, so encode each anchor explicitly.

Sketch of the filter chain (replacing the body of the `.filter(rel => { … })` in `discoverMarkdownFiles`):

```ts
.filter(rel => {
  const staticallySkipped = STATIC_SKIPS.some(p => globMatch(p, rel));
  const explicitlyIncluded =
    includes.length > 0 && includes.some(p => globMatch(p, rel));
  if (staticallySkipped && !explicitlyIncluded) return false;
  if (excludes.some(p => globMatch(p, rel))) return false;
  if (ignore.some(p => globMatch(p, rel))) return false;
  if (includes.length > 0 && !includes.some(p => globMatch(p, rel))) return false;
  return true;
})
```

This preserves the existing precedence rules (exclude > gitignore > include admission) and adds a single static-skip pass in front, with an explicit-include escape hatch. Do not change `walk`, `parseGitignore`, `globMatch`, or `relativePosix`.

Do not edit `bootstrap-state.json` semantics, `sha256Hex`, `readBootstrapState`, or `writeBootstrapState` — those stay exactly as they are. This task only adds discovery-time filtering.

</details>
