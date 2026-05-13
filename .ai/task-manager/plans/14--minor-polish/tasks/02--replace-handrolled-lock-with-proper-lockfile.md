---
id: 2
group: "minor-polish"
dependencies: [1]
status: "pending"
created: 2026-05-13
skills:
  - typescript
  - vitest
---
# Replace hand-rolled `state.json` lock with `proper-lockfile`; drop all lock bookkeeping

## Objective
Delete the hand-rolled named/PID/TTL lock implementation in `src/lib/state.ts` and replace it with `proper-lockfile` operating directly on `state.json` at the three call sites (`runCurate`, `runBootstrap`, `runProposalDrain`). Remove every schema field, settings field, default, and constant that existed only to feed the old implementation. Rewrite the affected tests to drive the new lock.

## Skills Required
- `typescript`: schema edits, settings edits, three call-site rewrites, and the `try/finally` lock/release pattern around `proper-lockfile.lock()`.
- `vitest`: rewrite `tests/lib/state.test.ts` and the three "lock held by another process" scenarios in `tests/lib/curate.test.ts`, `tests/lib/bootstrap.test.ts`, `tests/lib/proposal-drain.test.ts`.

## Acceptance Criteria
- [ ] `proper-lockfile` is present under `dependencies` in `package.json`; `@types/proper-lockfile` is present under `devDependencies`. `package-lock.json` is regenerated.
- [ ] `rg -n 'acquireLock|releaseLock|DEFAULT_LOCK_TTL_MS|LockOptions|CURATOR_LOCK_NAME|BOOTSTRAP_LOCK_NAME|PROPOSAL_LOCK_NAME|StateLockSchema|lockTtlMs' src/ tests/` returns zero hits.
- [ ] `StateFileSchema` no longer declares a `lock` field; `StateFile` continues to carry `schema_version` and `last_nudged_at`.
- [ ] `SettingsSchema.lockTtlMs` is deleted; `SETTINGS_DEFAULTS` no longer carries `lockTtlMs`; the docstring/comment block around the settings (`src/lib/schemas.ts:262-277`) no longer lists `lockTtlMs`.
- [ ] `runCurate`, `runBootstrap`, and `runProposalDrain` use `proper-lockfile.lock(stateFile, options)` and release via the returned callback (or `unlock(stateFile)`) in a `try/finally`. `ELOCKED` errors are caught and returned as the existing "locked" result; other errors propagate.
- [ ] A shared constant (e.g. `STATE_LOCK_OPTIONS = { stale: 30 * 60 * 1000, realpath: false }`) is defined once in `src/lib/state.ts` and imported by the three call sites.
- [ ] `src/commands/curate.ts:63`, `src/commands/bootstrap-incremental.ts:64`, and `src/hooks/kb-proposal-drain.ts:62` no longer reference `settings.lockTtlMs`.
- [ ] `CurateContext`, `BootstrapContext`, and `ProposalDrainContext` no longer declare `lockTtlMs?`. No `...(ctx.lockTtlMs !== undefined ? { ttlMs: ctx.lockTtlMs } : {})` spreads remain.
- [ ] `tests/lib/state.test.ts` is rewritten to cover only `readState` / `writeState` round-trip (including loading a `state.json` that carries an obsolete `lock` field without error).
- [ ] `tests/lib/curate.test.ts`, `tests/lib/bootstrap.test.ts`, and `tests/lib/proposal-drain.test.ts` each acquire the `proper-lockfile` lock on `state.json` directly (using the same `STATE_LOCK_OPTIONS`) to set up the "another holder" scenario, and assert the production function returns the locked-result message.
- [ ] No `it.skip` / `describe.skip` is introduced.
- [ ] `npm run lint && npm run typecheck && npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `proper-lockfile`'s `lock(file, options)` returns a release function; the call shape is:
  ```ts
  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(stateFile, STATE_LOCK_OPTIONS);
    // ...protected work
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOCKED') {
      return /* existing locked-result message */;
    }
    throw err;
  } finally {
    if (release !== undefined) await release();
  }
  ```
- `state.json` is created by `readState`/`writeState` before lock acquisition, so the file always exists when `lock()` runs. `realpath: false` is still recommended as a safety default.
- `StateFileSchema` is not declared `.strict()`, so existing on-disk files that still carry the now-removed `lock` field load without error. No migration code is needed. Verify this in the rewritten `tests/lib/state.test.ts`.
- The plan's deletion list (use it as a definitive checklist):
  - `src/lib/state.ts`: delete `DEFAULT_LOCK_TTL_MS`, `LockOptions`, `acquireLock`, `releaseLock`. Keep `readState` and `writeState`. Add a `STATE_LOCK_OPTIONS` export.
  - `src/lib/schemas.ts`: delete `StateLockSchema`, the `.lock` field on `StateFileSchema`, the `.lockTtlMs` field on `SettingsSchema`, and the `lockTtlMs` line in the settings docstring (around lines 262-277).
  - `src/lib/settings.ts`: remove `lockTtlMs` from `SETTINGS_DEFAULTS` and from any `resolveSettings`/`mergeSettings` paths that thread it.
  - `src/lib/curate.ts:289-307`, `src/lib/bootstrap.ts:439`, `src/lib/proposal-drain.ts:81-85`: rewrite each acquire/release block using the pattern above.
  - `src/commands/curate.ts:63`, `src/commands/bootstrap-incremental.ts:64`, `src/hooks/kb-proposal-drain.ts:62`: drop the `lockTtlMs: settings.lockTtlMs,` line and remove the corresponding field from any context struct.
  - Delete `CURATOR_LOCK_NAME`, `BOOTSTRAP_LOCK_NAME`, `PROPOSAL_LOCK_NAME`.

## Input Dependencies
- Task 1 must be merged first (it edits a different region of `src/lib/schemas.ts`; sequencing avoids merge friction).

## Output Artifacts
- `package.json` / `package-lock.json` with `proper-lockfile` and `@types/proper-lockfile` added.
- Edited `src/lib/state.ts`, `src/lib/schemas.ts`, `src/lib/settings.ts`.
- Edited call sites: `src/lib/curate.ts`, `src/lib/bootstrap.ts`, `src/lib/proposal-drain.ts`.
- Edited command/hook entry points: `src/commands/curate.ts`, `src/commands/bootstrap-incremental.ts`, `src/hooks/kb-proposal-drain.ts`.
- Rewritten tests: `tests/lib/state.test.ts`, and the locked-scenario sections of `tests/lib/curate.test.ts`, `tests/lib/bootstrap.test.ts`, `tests/lib/proposal-drain.test.ts`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Install dependencies:
   ```bash
   npm install proper-lockfile
   npm install --save-dev @types/proper-lockfile
   ```
2. Audit all current references to be removed:
   ```bash
   rg -n 'acquireLock|releaseLock|DEFAULT_LOCK_TTL_MS|LockOptions|CURATOR_LOCK_NAME|BOOTSTRAP_LOCK_NAME|PROPOSAL_LOCK_NAME|StateLockSchema|lockTtlMs|state\.lock\b' src/ tests/
   ```
   Use the output as your worklist; every hit must be either rewritten or deleted by the time you finish.
3. Rewrite `src/lib/state.ts`:
   - Keep `readState`, `writeState`.
   - Delete `DEFAULT_LOCK_TTL_MS`, `LockOptions`, `acquireLock`, `releaseLock`.
   - Add:
     ```ts
     import lockfile from 'proper-lockfile';
     export const STATE_LOCK_OPTIONS = { stale: 30 * 60 * 1000, realpath: false } as const;
     export { lockfile };
     ```
     (or import `proper-lockfile` directly in each call site; pick whichever yields the cleanest call shape — the shared `STATE_LOCK_OPTIONS` constant is the part that must stay centralized.)
4. Edit `src/lib/schemas.ts`:
   - Delete `StateLockSchema`.
   - Delete the `lock: StateLockSchema.optional()` (or similar) field on `StateFileSchema`. Keep `schema_version` and `last_nudged_at`.
   - Delete `.lockTtlMs` from `SettingsSchema`.
   - In the settings docstring (around lines 262-277), remove the `lockTtlMs` bullet/line.
5. Edit `src/lib/settings.ts`:
   - Remove `lockTtlMs` from `SETTINGS_DEFAULTS`.
   - Remove any merge/resolve logic that threaded the setting; the rest of the merging untouched.
6. Rewrite the three call sites (`runCurate`, `runBootstrap`, `runProposalDrain`) using the `try/release` pattern in **Technical Requirements**. The "locked" result returned on `ELOCKED` should preserve the existing user-facing message so downstream tests pass with minimal change.
7. In each context type (`CurateContext`, `BootstrapContext`, `ProposalDrainContext`), drop the `lockTtlMs?` field. Adjust constructors / spreads.
8. In `src/commands/curate.ts`, `src/commands/bootstrap-incremental.ts`, `src/hooks/kb-proposal-drain.ts`, remove the line that forwards `settings.lockTtlMs` into the context. Remove any related local variable.
9. Delete `CURATOR_LOCK_NAME`, `BOOTSTRAP_LOCK_NAME`, `PROPOSAL_LOCK_NAME` and every reference to them.
10. Rewrite `tests/lib/state.test.ts`:
    - Drop every test that exercised lock acquire/stale/release/foreign-PID.
    - Keep or add: a `readState` / `writeState` round-trip; a test that loads a hand-crafted `state.json` containing an obsolete `lock: { ... }` object and asserts that `readState` returns successfully and the returned `StateFile` does not carry a `lock` field (the schema silently drops unknown keys).
11. Rewrite the locked-scenario tests in `tests/lib/curate.test.ts:366`, `tests/lib/bootstrap.test.ts:369`, `tests/lib/proposal-drain.test.ts:147`:
    - Import `proper-lockfile` directly in the test file.
    - Acquire the lock on the fixture's `state.json` with the same `STATE_LOCK_OPTIONS` before invoking the production function.
    - Assert the production function returns the existing locked-result shape (whichever exact field/message it returns today).
    - Release the lock in `afterEach` or via a `try/finally`.
12. Run `npm run lint && npm run typecheck && npm test`. Fix any consumer or test that still references the removed names.
13. Final sweep: re-run the `rg` from step 2; expect zero hits in `src/` and `tests/`.

</details>
