---
id: 1
group: "test-seams"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - vitest
---
# Remove `spawn?` seam from `RunHeadlessOptions`; migrate tests to `vi.mock('execa')`

## Objective
Delete the `spawn?: SpawnFn` test-seam field (and its supporting `SpawnFn` / `SpawnContext` / `defaultSpawn` indirection) from `src/lib/headless.ts`, inline the single `execa(...)` call, and rewrite `tests/lib/headless.test.ts` so spawn substitution happens at the `execa` import boundary via `vi.mock('execa')`.

## Skills Required
- `typescript`: edit `src/lib/headless.ts` and any consumer code that still references the deleted types.
- `vitest`: rewrite `tests/lib/headless.test.ts` (and any other test that injects a `spawn`) using `vi.mock`, `vi.mocked`, and `mockImplementationOnce`.

## Acceptance Criteria
- [ ] `RunHeadlessOptions` no longer declares `spawn?`.
- [ ] `defaultSpawn` is deleted; its body is inlined into the single `execa(...)` call inside `runHeadlessClaude`.
- [ ] `SpawnFn`, `SpawnContext`, and `SpawnResult` types are deleted unless an external consumer is found via `rg -n 'SpawnFn|SpawnContext|SpawnResult' src/ tests/`. Document leftover hits in the PR description.
- [ ] No occurrence of `// Test seam:` remains in `src/lib/headless.ts`.
- [ ] `tests/lib/headless.test.ts` uses `vi.mock('execa', () => ({ execa: vi.fn() }))` at module scope; each test sets behaviour via `vi.mocked(execa).mockImplementationOnce(...)` and resets with `vi.clearAllMocks()` in `afterEach`.
- [ ] Every previously passing assertion in `tests/lib/headless.test.ts` still passes; no `it.skip`/`describe.skip` introduced.
- [ ] `rg -n '\bspawn\?:' src/lib/headless.ts` returns zero hits.
- [ ] `npm run lint && npm run typecheck && npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The only production call site for `spawn` is inside `runHeadlessClaude`; replace it with a direct `execa(command, ctx.args, opts)` call.
- Per the plan's risk note, `vi.mock` is hoisted by Vitest; the `execa` import inside the test must come *after* the `vi.mock` declaration (Vitest handles the order automatically when both are top-level).
- The existing test helpers (synthetic spawn building functions) move into the `mockImplementationOnce` closures, or into a small local helper inside the test file. Do not create a new top-level helper module unless the helper is reused by another test file.
- `runHeadlessClaude`'s callers (`src/commands/curate.ts`, `src/commands/bootstrap-incremental.ts`) currently forward `runnerOpts` straight through; no call-site changes are expected. Confirm with `rg`.

## Input Dependencies
None.

## Output Artifacts
- Edited `src/lib/headless.ts` (interface shrinks; types possibly deleted; one direct `execa` call).
- Rewritten `tests/lib/headless.test.ts`.
- Any consumer test that previously injected `spawn` migrated to `vi.mock('execa')`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. `rg -n 'SpawnFn|SpawnContext|SpawnResult|defaultSpawn' src/ tests/` to enumerate every reference. Inspect each. Anything outside `src/lib/headless.ts` and its tests is unexpected; investigate before deleting.
2. In `src/lib/headless.ts`:
   - Delete the `spawn?: SpawnFn` field from `RunHeadlessOptions` and the leading `// Test seam: ...` comment.
   - Delete `defaultSpawn`. Inline its body where `spawn(...)` is currently invoked (around the original lines 112-117). The call becomes a direct `execa(command, ctx.args, opts)` (use the same options object shape the indirection was building).
   - Delete `SpawnFn`, `SpawnContext`, and `SpawnResult` type exports if no remaining consumer references them.
   - Keep the `import { execa } from 'execa'` at the top of the file.
3. In `tests/lib/headless.test.ts`:
   - Top of file:
     ```ts
     import { execa } from 'execa';
     vi.mock('execa', () => ({ execa: vi.fn() }));
     ```
     Vitest hoists `vi.mock`; the order in the source is fine as-is.
   - Replace every `runHeadlessClaude({ ..., spawn: makeSyntheticSpawn(...) })` call with the same call minus `spawn:`. The synthetic spawn becomes the `mockImplementationOnce` for `execa`.
   - Example shape:
     ```ts
     vi.mocked(execa).mockImplementationOnce((cmd, args, opts) => {
       // return whatever the old synthetic spawn returned; the shape matches execa's ResultPromise
       return makeExecaStub(...);
     });
     ```
   - Add `afterEach(() => { vi.clearAllMocks(); });` if not already present.
4. Run `npm run lint && npm run typecheck && npm test`. Fix any consumer test that still references `spawn` until the whole suite is green.
5. Re-run the static sweeps: `rg -n 'Test seam' src/lib/headless.ts`, `rg -n '\bspawn\?:' src/lib/headless.ts`.

</details>
