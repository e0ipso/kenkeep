---
id: 2
group: "tests"
dependencies: [1]
status: "pending"
created: 2026-05-13
skills:
  - vitest
---
# Update hook-command assertions and add subdirectory-CWD regression test

## Objective

Bring the existing assertions in `tests/init.test.ts` in line with the new emitted command form, and add a regression test that reproduces the original `MODULE_NOT_FOUND` failure mode (Node invoked from a subdirectory with a CWD-relative script path) and confirms the new commands load the hook script regardless of CWD. Together these tests lock the new contract and prevent the bug class from recurring silently.

## Skills Required

- vitest: extend an existing test file using the project's sandbox helpers, write a string-substring assertion across all owned hook commands, and spawn a child process via `child_process` from a custom working directory with a controlled env.

## Acceptance Criteria

- [ ] The three assertions previously at `tests/init.test.ts` lines 164, 186, 190 are updated to expect the new command strings (`node "$CLAUDE_PROJECT_DIR/.claude/hooks/<script>.mjs"`), byte-identical to `EXPECTED_HOOK_COMMANDS`.
- [ ] A new assertion confirms that, after `init`, every owned hook command (the five entries across `Stop`, `SessionEnd`, `PreCompact`, `SessionStart`) contains the literal substring `"$CLAUDE_PROJECT_DIR/.claude/hooks/`. This is the cheap fast guard against template-string regressions.
- [ ] A new integration-style regression test reproduces the original bug:
  - Runs `init` in a sandbox.
  - Creates a subdirectory under the sandbox.
  - Spawns the `Stop` hook command via `sh -c` from that subdirectory with `CLAUDE_PROJECT_DIR=<sandbox-root>`.
  - Asserts that the child process's combined stderr does **not** contain `MODULE_NOT_FOUND` and does **not** contain `Cannot find module`. (The process may exit non-zero for unrelated reasons such as missing transcript input; that is acceptable. The test must not assert exit code 0.)
- [ ] `npm test` passes.
- [ ] The regression test demonstrably fails on the pre-fix code path. Verify this once during implementation by temporarily reverting the adapter template in `src/adapters/claude.ts` to the old form, re-running the test, observing failure, then restoring the fix. Do not commit the revert.
- [ ] No retrospective framing in test names or comments. Tests describe current behavior only.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `tests/init.test.ts`. Use existing patterns: `runCli(sandbox, [...])`, `readFileSync`, the `sandbox` lifecycle already in place at the top of the file. Reuse `EXPECTED_HOOK_COMMANDS`-style strings inline; do not import the constant from `src/commands/init.ts` (the tests treat the emission as a black-box contract).
- The integration test will need `mkdirSync` and `spawnSync` (or equivalent) from `node:child_process`. Run the command via `sh -c '<command-string>'` with `cwd` set to the subdirectory and `env: { ...process.env, CLAUDE_PROJECT_DIR: sandbox }`. Pipe `</dev/null` (empty stdin) or pass `input: ''` to `spawnSync`.
- The test reads the emitted command directly from `.claude/settings.json` rather than hard-coding the command string, so a future filename change in `kb-capture.mjs` does not silently desync. Read the `Stop` entry's command, then pass it verbatim to `sh -c`.
- Substring assertion: walk every event in `EXPECTED_HOOK_COMMANDS`'s event set (`Stop`, `SessionEnd`, `PreCompact`, `SessionStart`) and assert each command contains `"$CLAUDE_PROJECT_DIR/.claude/hooks/` (a literal substring with embedded double quote).

## Input Dependencies

- Task 1: the new command form is emitted by the adapter and expected by `init.ts`.

## Output Artifacts

- Edited `tests/init.test.ts`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

**Meaningful Test Strategy Guidelines** (from the generator's mantra: "write a few tests, mostly integration"):
- The substring guard is a single cheap unit assertion folded into the existing settings test; no new test file.
- The subdirectory-CWD repro is an integration test against a real spawned `node` process. It is exactly the test that would have caught the original bug, which is why it earns a dedicated `it()` block.
- We do not add per-event tests, per-script tests, or per-CWD-permutation tests. One integration test plus one substring guard covers the regression surface.

**Step 1 — update the three existing assertions.**

In `tests/init.test.ts`:

- Line 164 currently reads:
  ```ts
  expect(entries?.[0]?.hooks[0]?.command).toBe(
    `node .claude/hooks/kb-capture.mjs`
  );
  ```
  Change the expected value to `'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"'`. Use single-quoted JS strings so the embedded double quotes need no escaping; the surrounding template literal can be flattened to a plain string literal.

- Lines 186 and 190 (inside the `registers SessionStart drain (async) and session-start (sync) hooks` test): update each `command:` value to the new form:
  - `'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-proposal-drain.mjs"'`
  - `'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-session-start.mjs"'`

**Step 2 — extend the existing "registers Stop/SessionEnd/PreCompact" test (or add a new sibling test) with the substring guard.**

After the existing per-event check, iterate all four owned events and assert each command contains the substring `"$CLAUDE_PROJECT_DIR/.claude/hooks/`:

```ts
const ownedEvents = ['Stop', 'SessionEnd', 'PreCompact', 'SessionStart'] as const;
for (const event of ownedEvents) {
  const entries = settings.hooks?.[event] ?? [];
  const flat = entries.flatMap(e => e.hooks);
  expect(flat.length).toBeGreaterThan(0);
  for (const h of flat) {
    expect(h.command).toContain('"$CLAUDE_PROJECT_DIR/.claude/hooks/');
  }
}
```

Note the literal substring includes a leading double quote. Use a single-quoted JS string to avoid escaping.

**Step 3 — add the integration regression test.**

Inside the same `describe` block (so the `sandbox` lifecycle hook applies), add:

```ts
it('emitted Stop hook command loads when invoked from a subdirectory CWD', async () => {
  await runCli(sandbox, ['init', '--assistants', 'claude']);

  const settings = JSON.parse(
    readFileSync(join(sandbox, '.claude/settings.json'), 'utf8')
  ) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
  const stopCommand = settings.hooks['Stop']?.[0]?.hooks[0]?.command;
  expect(stopCommand).toBeDefined();

  const subdir = join(sandbox, 'nested/leaf');
  mkdirSync(subdir, { recursive: true });

  const { spawnSync } = await import('node:child_process');
  const result = spawnSync('sh', ['-c', stopCommand as string], {
    cwd: subdir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: sandbox },
    encoding: 'utf8',
    input: '',
  });

  const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  expect(combined).not.toContain('MODULE_NOT_FOUND');
  expect(combined).not.toContain('Cannot find module');
});
```

Add the imports `mkdirSync` from `node:fs` (if not already imported) at the top of the file. Do **not** import `spawnSync` at the top; the dynamic `import('node:child_process')` inside the test keeps it scoped, matching the existing helper-loading patterns in the file. Static top-of-file import is equally acceptable if the file already imports from `node:child_process` elsewhere.

**Step 4 — verify the regression test catches the bug.**

Temporarily revert `src/adapters/claude.ts` line 58 to the old `node ${hook.scriptPath}` form, then run `npm test -- tests/init.test.ts`. The new integration test should fail with a `MODULE_NOT_FOUND` (or `Cannot find module`) substring in the captured output. Restore the fix and re-run; all tests should pass. Do not commit the revert.

**Step 5 — final test run.**

`npm test` from `/workspace`. All tests must pass.

</details>
