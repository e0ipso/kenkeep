---
id: 4
group: "context-shapes"
dependencies: [3]
status: "pending"
created: 2026-05-13
skills:
  - typescript
  - vitest
---
# Collapse per-context path fields to `paths: RepoPaths`; remove `now?` and `pid?` from `BootstrapContext`, `CurateContext`, `DrainContext`

## Objective
Replace the six-or-seven discrete path fields on `BootstrapContext`, `CurateContext`, and `DrainContext` with a single `paths: RepoPaths` reference. Derive `state.json` / `bootstrap-state.json` paths locally inside the consumer functions. Delete the `now?: () => Date` and `pid?: number` test-seam fields from all three contexts. Add a one-line `src/lib/process.ts` indirection for `process.pid` so tests can mock it at the module boundary, and migrate the affected tests to use Vitest fake timers plus the new `pid` module mock.

## Skills Required
- `typescript`: edit interfaces, consumer functions, and construction sites across `src/lib/` and `src/commands/`.
- `vitest`: migrate `tests/lib/bootstrap.test.ts`, `tests/lib/curate.test.ts`, `tests/lib/proposal-drain.test.ts`, and any integration tests that built these contexts.

## Acceptance Criteria
- [ ] `BootstrapContext` declares `paths: RepoPaths` and no longer declares `kbDir`, `repoRoot`, `nodesDir`, `logsDir`, `stateFile`, `bootstrapStateFile`. `sourceDir` (the `--from` argument) remains.
- [ ] `CurateContext` declares `paths: RepoPaths` and no longer declares `kbDir`, `sessionsDir`, `nodesDir`, `logsDir`, `stateFile`.
- [ ] `DrainContext` declares `paths: RepoPaths` and no longer declares `sessionsDir`, `logsDir`, `stateFile`.
- [ ] `now?: () => Date` and `pid?: number` are deleted from all three context interfaces; the literal `// Test seam:` comments are gone.
- [ ] `runBootstrapIncremental`, `runCurate`, and `drainProposalQueue` derive `stateFile` / `bootstrapStateFile` locally with `join(ctx.paths.stateDir, 'state.json')` / `'bootstrap-state.json'`. All other path lookups read through `ctx.paths.*`.
- [ ] Every `ctx.now ?? (() => new Date())` (or equivalent) is replaced with `new Date()`; every `ctx.pid ?? process.pid` is replaced with a call to a single-line `pid()` indirection exported from `src/lib/process.ts` (`export function currentPid(): number { return process.pid; }` — or equivalent naming).
- [ ] Construction sites (`src/commands/bootstrap-incremental.ts`, `src/commands/curate.ts`, `src/hooks/kb-proposal-drain.ts`) build their contexts directly with `paths` plus optional spreads only for genuinely optional fields. No more individual `kbDir`, `nodesDir`, etc. assignments.
- [ ] Tests use `vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date('2026-01-01T00:00:00Z'))` (or similar fixed date) in `beforeEach` and `vi.useRealTimers()` in `afterEach`. The previously-injected `now: () => ...` values are gone.
- [ ] Tests use `vi.mock('<path-to>/process.ts', () => ({ currentPid: vi.fn(() => 12345) }))` (or `vi.spyOn(processModule, 'currentPid')`) to substitute the pid. The previously-injected `pid: 12345` values are gone.
- [ ] Each test file restores its mocks (`vi.restoreAllMocks()` or `vi.clearAllMocks()` in `afterEach`).
- [ ] Static sweeps return zero hits:
  - `rg -n '\bnow\?:' src/lib/bootstrap.ts src/lib/curate.ts src/lib/proposal-drain.ts`
  - `rg -n '\bpid\?:' src/lib/bootstrap.ts src/lib/curate.ts src/lib/proposal-drain.ts`
  - `rg -n 'kbDir|nodesDir|logsDir|sessionsDir|stateFile' src/lib/bootstrap.ts src/lib/curate.ts src/lib/proposal-drain.ts` returns matches only as `ctx.paths.X` reads or locally-derived constants.
- [ ] Each affected interface has ≤ 10 non-optional fields.
- [ ] `npm run lint && npm run typecheck && npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `RepoPaths` is the existing record returned by `repoPaths(root)`. Import it from its current home.
- `src/lib/process.ts` is a new file with a single one-line exported function returning `process.pid`. Do not document it as a test seam in comments; it is a single-source-of-truth indirection that happens to be mockable.
- `vi.useFakeTimers({ toFake: ['Date'] })` keeps real microtasks/I/O unaffected, which matters because `runCurate` and `runBootstrapIncremental` are async with real awaits.
- Plan ordering assumption: plans 9-12 have landed. `runId?` and `lockTtlMs?` are already absent; do not re-introduce them.

## Input Dependencies
- Task 3 — touches `src/commands/curate.ts`, `src/commands/bootstrap-incremental.ts` (`.action` handlers); this task touches the same files (context construction). Sequencing avoids merge conflicts.

## Output Artifacts
- Edited `src/lib/bootstrap.ts`, `src/lib/curate.ts`, `src/lib/proposal-drain.ts`.
- New `src/lib/process.ts` (one exported function).
- Edited construction sites: `src/commands/bootstrap-incremental.ts`, `src/commands/curate.ts`, `src/hooks/kb-proposal-drain.ts`.
- Rewritten tests in `tests/lib/bootstrap.test.ts`, `tests/lib/curate.test.ts`, `tests/lib/proposal-drain.test.ts`, plus any integration test that constructs these contexts directly.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. **Create `src/lib/process.ts`**:
   ```ts
   export function currentPid(): number {
     return process.pid;
   }
   ```
   No comment about tests. Just a one-line export.
2. **`src/lib/bootstrap.ts`**:
   - Edit `BootstrapContext`: delete `kbDir`, `repoRoot`, `nodesDir`, `logsDir`, `stateFile`, `bootstrapStateFile`, `now?`, `pid?`. Keep `sourceDir`. Add `paths: RepoPaths`. Confirm the resulting field count is ≤ 10.
   - Inside `runBootstrapIncremental`:
     ```ts
     const stateFile = join(ctx.paths.stateDir, 'state.json');
     const bootstrapStateFile = join(ctx.paths.stateDir, 'bootstrap-state.json');
     ```
     near the top. Replace `ctx.repoRoot` → `ctx.paths.root`, `ctx.kbDir` → `ctx.paths.kbDir`, etc.
   - Replace `ctx.now ?? (() => new Date())` with `new Date()` at every usage. Replace `ctx.pid ?? process.pid` with `currentPid()` and import from `./process.js` (use the project's existing `.js` extension convention for ESM imports).
3. **`src/lib/curate.ts`**: identical pattern. Delete `kbDir`, `sessionsDir`, `nodesDir`, `logsDir`, `stateFile`, `now?`, `pid?` from `CurateContext`. Add `paths: RepoPaths`. Derive `stateFile` locally. Replace `now`/`pid` usages.
4. **`src/lib/proposal-drain.ts`**: same pattern. Delete `sessionsDir`, `logsDir`, `stateFile`, `now?`, `pid?` from `DrainContext`. Add `paths: RepoPaths`. Derive `stateFile` locally. Replace `now`/`pid` usages.
5. **Construction sites**:
   - `src/commands/bootstrap-incremental.ts:53-75`: replace the per-field assignments with a direct construction:
     ```ts
     const ctx: BootstrapContext = {
       sourceDir,
       paths,
       promptTemplate,
       runner,
       ...(opts.include !== undefined ? { include: opts.include } : {}),
       ...(opts.exclude !== undefined ? { exclude: opts.exclude } : {}),
       ...(opts.dryRun ? { dryRun: true } : {}),
       ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
       ...(settings.bootstrapModel ? { model: settings.bootstrapModel.name, effort: settings.bootstrapModel.effort } : {}),
     };
     ```
     Adjust fields to match whatever survives plans 11/12.
   - `src/commands/curate.ts`: same collapse for the `CurateContext` construction. Verify the line range at edit time.
   - `src/hooks/kb-proposal-drain.ts`: pass `paths` (the `repoPaths(root)` result already on hand) into the new `DrainContext` directly.
6. **Tests** (one file at a time, run `npm test -- <path>` after each):
   - `tests/lib/bootstrap.test.ts`:
     - Construct context as `{ sourceDir, paths: repoPaths(tmpRoot), promptTemplate, runner, ... }`.
     - Add at top:
       ```ts
       import * as processModule from '../../src/lib/process.js';
       beforeEach(() => {
         vi.useFakeTimers({ toFake: ['Date'] });
         vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
         vi.spyOn(processModule, 'currentPid').mockReturnValue(12345);
       });
       afterEach(() => {
         vi.useRealTimers();
         vi.restoreAllMocks();
       });
       ```
     - Remove `now:` and `pid:` from every context literal.
     - Snapshot strings that included the previous fixed date/pid should match by construction; if not, update them to match the new fixed values.
   - `tests/lib/curate.test.ts`: same pattern.
   - `tests/lib/proposal-drain.test.ts`: same pattern.
   - Any integration test under `tests/` that built one of these contexts directly: apply the same migration.
7. **Verification**:
   - `npx tsc --noEmit`
   - `npm test`
   - Static sweeps from Acceptance Criteria.
   - For curator log filenames previously derived from `now`, confirm the new deterministic filename via fake timers matches the assertions.

</details>
