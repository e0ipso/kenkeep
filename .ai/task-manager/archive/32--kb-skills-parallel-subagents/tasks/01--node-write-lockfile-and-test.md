---
id: 1
group: "cli-primitive"
dependencies: []
status: "completed"
created: 2026-05-23
skills:
  - typescript
  - vitest
---
# Add `proper-lockfile` to `node write` `bootstrap-state.json` RMW and verify with a concurrent-callers test

## Objective

Wrap the `updateBootstrapState` read-modify-write inside `src/commands/node-write.ts` with a short-lived `proper-lockfile` lock so concurrent `node write --source-doc <X> --source-hash <H>` invocations from parallel host sub-agents cannot lose updates to `bootstrap-state.json`. Add a vitest case that proves the lock serialises the RMW.

## Skills Required

- `typescript` — modify `src/commands/node-write.ts`; reuse the existing `proper-lockfile` lock pattern (already used by `src/lib/proposal-drain.ts`).
- `vitest` — add a concurrent-callers test in `tests/commands/node-write.test.ts`.

## Acceptance Criteria

- [ ] `updateBootstrapState` in `src/commands/node-write.ts` is wrapped in a `proper-lockfile` lock on the file `<paths.stateDir>/bootstrap-state.json` (lazy-creating the file if missing — `proper-lockfile` requires the target to exist; see Implementation Notes).
- [ ] The lock is acquired immediately before `readBootstrapState` and released immediately after `writeBootstrapState`. No slow operation (network, large IO) runs under the lock.
- [ ] Lock options match `STATE_LOCK_OPTIONS` from `src/lib/state.ts` (`{ stale: 30 * 60 * 1000, realpath: false }`).
- [ ] `runNodeWriteCommand` is now `async` (already is) and propagates lock-release in a `try/finally` so a thrown error during the write still releases the lock.
- [ ] All other code paths in `node-write.ts` are byte-equivalent — no change to CLI surface, no change to single-caller behaviour, no change to the order "write node file first → then update state".
- [ ] `tests/commands/node-write.test.ts` gains a new test (e.g. `it('serialises concurrent --source-doc writers via proper-lockfile')`) that:
    - Forks **two concurrent** `runNodeWriteCommand` calls inside `Promise.all`, each passing distinct `--source-doc` / `--source-hash` values and distinct slugs so both should succeed.
    - Asserts both calls return exit code 0.
    - Reads `bootstrap-state.json` afterwards and asserts `docs[<X>]` AND `docs[<Y>]` both exist with their respective hashes and `produced_nodes` entries — proving neither write was clobbered.
- [ ] `npm test` runs green.
- [ ] `npm run typecheck` and `npm run lint` pass.

## Technical Requirements

- Reuse `lockfile.lock` from `proper-lockfile` exactly as `src/lib/proposal-drain.ts` does (`import lockfile from 'proper-lockfile'`).
- Reuse `STATE_LOCK_OPTIONS` from `src/lib/state.ts`.
- The lock target must be an existing file. `bootstrap-state.json` does **not** always exist before `node write` runs against it; on first-ever invocation the file is created by `writeBootstrapState`. The implementation must therefore lazy-create an empty placeholder (or call `writeBootstrapState` with the current — possibly empty — state) **before** taking the lock, OR use `proper-lockfile`'s ability to lock a non-existent file by passing `{ realpath: false }` and ensuring the lockfile sentinel `.lock` is permitted alongside.

  Concrete recommended approach: ensure the directory exists, then if the file is missing write an empty-state placeholder (`writeBootstrapState(file, { schema_version: 1, docs: {} })`) **before** calling `lockfile.lock`. `readBootstrapState` (which the lock protects) then sees a valid initial document. This matches the proposal-drain pattern where `state.json` is created by an earlier write.

## Input Dependencies

None.

## Output Artifacts

- Modified `src/commands/node-write.ts` with the lock-protected RMW.
- New concurrent-writers test in `tests/commands/node-write.test.ts`.

## Implementation Notes

<details>

### File: `src/commands/node-write.ts`

The function to change is `updateBootstrapState` (currently lines 174–197). The minimum-diff change is:

1. Add at the top of the file:
   ```ts
   import lockfile from 'proper-lockfile';
   import { STATE_LOCK_OPTIONS } from '../lib/state.js';
   ```
2. Convert `updateBootstrapState` to `async` and wrap its body in `lockfile.lock` / `release` per the `proposal-drain.ts` pattern (lines 71–99 of `src/lib/proposal-drain.ts`). Sketch:
   ```ts
   async function updateBootstrapState(args: UpdateBootstrapStateArgs): Promise<void> {
     const file = join(args.paths.stateDir, 'bootstrap-state.json');
     // Lazy-create so proper-lockfile has a real target.
     if (!existsSync(file)) {
       writeBootstrapState(file, { schema_version: 1, docs: {} });
     }
     const release = await lockfile.lock(file, STATE_LOCK_OPTIONS);
     try {
       const current = readBootstrapState(file);
       // … existing produced_nodes / next computation unchanged …
       writeBootstrapState(file, next);
     } finally {
       await release();
     }
   }
   ```
3. Update the single call site in `runNodeWriteCommand` (currently line 149) to `await updateBootstrapState({...})`. The outer function is already `async`, so this is a no-op shape change.

Do **not** introduce any new export. Do **not** add a CLI flag. The lock is invisible to callers.

### File: `tests/commands/node-write.test.ts`

Pattern after the existing tests in this file (`sandbox()` helper, `runNodeWriteCommand` driver). Two concurrent invocations:

```ts
it('serialises concurrent --source-doc writers via proper-lockfile', async () => {
  const out1 = capturingStdout();
  const out2 = capturingStdout();
  const [code1, code2] = await Promise.all([
    runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'use-foo',
        flags: {
          title: 'Use Foo', summary: 'sum1', tags: 'a',
          confidence: 'high',
          sourceDoc: 'docs/foo.md',
          sourceHash: 'a'.repeat(64),
        },
      },
      { readStdin: async () => 'body 1', isTTY: () => false, writeStdout: out1.write }
    ),
    runNodeWriteCommand(
      {
        kind: 'practice',
        slug: 'use-bar',
        flags: {
          title: 'Use Bar', summary: 'sum2', tags: 'b',
          confidence: 'high',
          sourceDoc: 'docs/bar.md',
          sourceHash: 'b'.repeat(64),
        },
      },
      { readStdin: async () => 'body 2', isTTY: () => false, writeStdout: out2.write }
    ),
  ]);
  expect(code1).toBe(0);
  expect(code2).toBe(0);
  const stateFile = join(cwd, '.ai/knowledge-base/.state/bootstrap-state.json');
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  expect(state.docs['docs/foo.md']?.content_sha256).toBe('a'.repeat(64));
  expect(state.docs['docs/bar.md']?.content_sha256).toBe('b'.repeat(64));
  expect(state.docs['docs/foo.md']?.produced_nodes).toContain('practice-use-foo');
  expect(state.docs['docs/bar.md']?.produced_nodes).toContain('practice-use-bar');
});
```

`Promise.all` does not guarantee true OS-level concurrency in Node's single-threaded loop, but the lock acquisition + filesystem IO under `await` is exactly where `proper-lockfile` enforces the contract. The test still demonstrates the lock-protected RMW does not drop either writer's state mutation; if the lock were removed and both invocations read the empty state in their event-loop turn before either wrote, only the last write would land — the test would then fail.

### Skill scope

This task is one `typescript` change and one `vitest` change. Do not also touch SKILL.md files, docs, or harness adapters — those are separate tasks. Keep the diff tight.

</details>
