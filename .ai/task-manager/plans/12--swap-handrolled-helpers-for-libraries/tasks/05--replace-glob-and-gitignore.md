---
id: 5
group: "library-swaps"
dependencies: [3]
status: "completed"
created: 2026-05-13
skills: ["typescript", "unit-testing"]
---
# Replace globMatch / parseGitignore with picomatch and ignore

## Objective
Remove the hand-rolled `globMatch`, `globToRegex`, and `parseGitignore` functions from `src/lib/bootstrap.ts` in favour of `picomatch` (for `--include`/`--exclude` globs) and `ignore` (for `.gitignore` semantics including negation). Update `DiscoverOptions` so consumers pass an `Ignore` instance instead of a string array, and add a test covering negation.

## Skills Required
- `typescript`: refactor library boundary, swap a data shape (`gitignorePatterns: string[]` → `Ignore` instance).
- `unit-testing`: add a focused test for `.gitignore` negation against `discoverMarkdownFiles`.

## Acceptance Criteria
- [ ] `picomatch` and `ignore` are added to `dependencies`; `@types/picomatch` is added to `devDependencies` in `package.json`.
- [ ] `src/lib/bootstrap.ts` no longer defines `globMatch`, `globToRegex`, or `parseGitignore`; those exports are removed.
- [ ] `rg -n 'globMatch|globToRegex|parseGitignore' src/` returns zero hits.
- [ ] `DiscoverOptions` is updated: the `gitignorePatterns?: string[]` field is replaced with `gitignore?: import('ignore').Ignore` (or equivalent). `discoverMarkdownFiles` uses `ig.ignores(relativePath)` for that check.
- [ ] `--include` and `--exclude` matching uses `picomatch(pattern)` compiled matchers (cache per pattern within the call to avoid recompilation per file).
- [ ] The `runBootstrapIncremental` call site builds the `Ignore` instance from the gitignore file contents via `ignore().add(text)` and passes it through `DiscoverOptions`.
- [ ] A new test covers `.gitignore` negation: a tmp source dir containing both `keep.md` and `drop.md` with a gitignore of `*.md\n!keep.md` results in `discoverMarkdownFiles` returning only `keep.md`. Add this to `tests/lib/bootstrap.test.ts`.
- [ ] Existing tests covering glob/gitignore behaviour still pass (or are updated to use the new `Ignore`-instance shape).
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0; `npm run build` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `picomatch` options: confirm defaults match existing behaviour; if existing tests assume dotfile matching (`{ dot: true }`) or case sensitivity, configure accordingly.
- `ignore` is the npm package `ignore` (singular); call `ignore().add(text).ignores(relPath)`.
- Maintain posix-style relative paths fed into both matchers (the existing `relativePosix()` helper already produces those).

## Input Dependencies
- Task 3 (ULID removal) — to avoid concurrent edits to `bootstrap.ts`.

## Output Artifacts
- Updated `package.json` and lockfile.
- Updated `src/lib/bootstrap.ts` (function deletions + new imports + revised `DiscoverOptions` + updated `runBootstrapIncremental`).
- Updated tests including a new negation case in `tests/lib/bootstrap.test.ts`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. `npm install picomatch ignore --save` and `npm install @types/picomatch --save-dev`.
2. In `src/lib/bootstrap.ts`:
   - Add `import picomatch from 'picomatch';` and `import ignore, { type Ignore } from 'ignore';`.
   - Delete `globMatch`, `globToRegex`, `parseGitignore` (lines 159-230).
   - Change `DiscoverOptions`:
     ```ts
     export interface DiscoverOptions {
       sourceDir: string;
       repoRoot: string;
       include?: string[];
       exclude?: string[];
       gitignore?: Ignore;
     }
     ```
   - In `discoverMarkdownFiles`, build the matchers up front:
     ```ts
     const includeMatchers = (opts.include ?? []).map(p => picomatch(p));
     const excludeMatchers = (opts.exclude ?? []).map(p => picomatch(p));
     const ig = opts.gitignore;
     ```
     Then in the filter chain:
     ```ts
     .filter(rel => {
       if (excludeMatchers.some(m => m(rel))) return false;
       if (ig && ig.ignores(rel)) return false;
       if (includeMatchers.length > 0 && !includeMatchers.some(m => m(rel))) return false;
       return true;
     })
     ```
   - In `runBootstrapIncremental`, replace the `parseGitignore` block with:
     ```ts
     const gitignorePath = join(ctx.repoRoot, '.gitignore');
     const gitignoreInstance = existsSync(gitignorePath)
       ? ignore().add(readFileSync(gitignorePath, 'utf8'))
       : undefined;

     const discoverOpts: DiscoverOptions = {
       sourceDir: ctx.sourceDir,
       repoRoot: ctx.repoRoot,
     };
     if (gitignoreInstance) discoverOpts.gitignore = gitignoreInstance;
     ```
     Preserve the existing `if (ctx.include !== undefined)` / `if (ctx.exclude !== undefined)` assignments.
3. Update existing tests:
   - Any test that imported `globMatch` or `parseGitignore` directly must be rewritten or removed. `discoverMarkdownFiles` is the public surface; cover behaviour through it.
   - Tests that built `gitignorePatterns: [...]` should build an `Ignore` via `ignore().add('...')`.
4. Add the new negation test in `tests/lib/bootstrap.test.ts`:
   - Use `mkdtempSync(join(tmpdir(), 'kb-bootstrap-'))`, write `keep.md` and `drop.md`, write `.gitignore` containing `*.md\n!keep.md`, build an `Ignore` from that text, call `discoverMarkdownFiles`, and assert the result is exactly `['keep.md']`.
5. Verify:
   - `rg -n 'globMatch|globToRegex|parseGitignore' src/` → zero hits.
   - `npx tsc --noEmit && npm test && npm run build` → green.
6. Watch for `picomatch` behaviour drift: existing tests likely surface any (escaping, brace expansion, dotfile defaults). Resolve any failure by configuring picomatch options (e.g., `picomatch(p, { dot: true })`) rather than by hand-rolling around it. Document option choices inline.

</details>
