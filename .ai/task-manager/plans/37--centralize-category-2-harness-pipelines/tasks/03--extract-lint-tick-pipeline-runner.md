---
id: 3
group: "pipeline-extraction"
dependencies: []
status: completed
created: 2026-05-26
skills:
  - typescript-modules
---
# Extract lint-tick pipeline runner into src/lib/

## Objective

Create a new `runLintTick(startCwd: string, harnessTag: string): Promise<void>` function in `src/lib/lint-state.ts` (or a new `src/lib/lint-tick.ts`) that encapsulates the counter increment, threshold check, `runLint()` call, and state write. Replace the near-identical pipeline bodies in all four `kb-lint-tick.ts` hooks with a call to this function. The only per-harness difference — how `startCwd` is extracted from stdin — stays in each hook.

## Skills Required

- TypeScript ESM module authoring and import management

## Acceptance Criteria

- [ ] `runLintTick(startCwd: string, harnessTag: string): Promise<void>` is exported from `src/lib/lint-state.ts` or a new `src/lib/lint-tick.ts`
- [ ] `grep -n "sessions_since_last_lint" src/harnesses/*/hooks/kb-lint-tick.ts` returns zero matches
- [ ] `grep -n "readLintState\|writeLintState" src/harnesses/*/hooks/kb-lint-tick.ts` returns zero matches
- [ ] All four `kb-lint-tick.ts` hooks call `runLintTick(startCwd, '<harness>:kb-lint-tick')`
- [ ] `npm run build` succeeds with no new errors
- [ ] `npm test` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Function signature: `export async function runLintTick(startCwd: string, harnessTag: string): Promise<void>`
- The function body (in order):
  1. `findRepoRoot(startCwd)` + `repoPaths(root)` + `installedVersionFile` guard
  2. `resolveSettings(...)` → `settings.lintEveryNSessions` → `threshold`
  3. `readLintState(stateFile)` → `nextCount = state.sessions_since_last_lint + 1`
  4. If `nextCount < threshold`: `writeLintState(...)` with incremented counter and return
  5. Else: stderr progress message, `runLint({ nodesDir })`, `writeLintState(...)` reset, stderr done message
- The `harnessTag` parameter is passed to `appendHookDiagnostic` in the `catch` block if one is needed, or is used only for error context
- Each hook's `main()` is reduced to: recursion guard → read stdin → extract `startCwd` using the harness-specific idiom → call `runLintTick(startCwd, '<harness>:kb-lint-tick')`
- Per-harness `startCwd` extraction (stays in hooks, not centralized):
  - Claude, Codex, OpenCode: `typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd()`
  - Cursor: `Array.isArray(roots) && typeof roots[0] === 'string' && roots[0].length > 0 ? roots[0] : process.cwd()`

## Input Dependencies

None — this task has no dependencies.

## Output Artifacts

- New or modified lib file (`src/lib/lint-state.ts` or `src/lib/lint-tick.ts`) exporting `runLintTick()`
- Modified `src/harnesses/claude/hooks/kb-lint-tick.ts`
- Modified `src/harnesses/codex/hooks/kb-lint-tick.ts`
- Modified `src/harnesses/cursor/hooks/kb-lint-tick.ts`
- Modified `src/harnesses/opencode/hooks/kb-lint-tick.ts`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Step 1: Read all four lint-tick hooks

Read all four to confirm the pipeline body is identical except for `startCwd` extraction. The body inside the `try` block should be byte-for-byte the same across all four.

### Step 2: Decide where to add the function

Option A: Add `runLintTick()` directly to `src/lib/lint-state.ts`. It already imports `runLint`, `findRepoRoot`, `repoPaths`, `resolveSettings`. This avoids creating a new file.

Option B: Create `src/lib/lint-tick.ts`. Choose this if `lint-state.ts` is already large or if the linting pipeline feels out of scope for a state-management module.

Choose whichever feels more coherent after reading `lint-state.ts`.

### Step 3: Implement `runLintTick()`

```typescript
export async function runLintTick(startCwd: string, harnessTag: string): Promise<void> {
  const PACKAGE_TAG = '[ai-knowledge-base]';
  const root = findRepoRoot(startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) return;

  try {
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const stateFile = lintStateFile(paths.stateDir);
    const state = readLintState(stateFile);
    const threshold = settings.lintEveryNSessions;
    const nextCount = state.sessions_since_last_lint + 1;

    if (nextCount < threshold) {
      writeLintState(stateFile, { ...state, sessions_since_last_lint: nextCount });
      return;
    }

    process.stderr.write('🔍 KB Lint: Running knowledge base lint…\n');
    const result = runLint({ nodesDir: paths.nodesDir });
    writeLintState(stateFile, {
      schema_version: 1,
      sessions_since_last_lint: 0,
      last_lint_at: new Date().toISOString(),
      last_errors: result.errors.length,
      last_findings: result.findings.length,
    });
    process.stderr.write('🧹 KB Lint: Knowledge base lint complete.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} lint tick error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}
```

**Important**: copy the exact strings and state structure from the live source files rather than trusting this snippet.

### Step 4: Update each hook

Each hook's `main()` is reduced to:

```typescript
async function main(): Promise<void> {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};  // or { workspace_roots?: unknown } for cursor
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('<harness>:kb-lint-tick', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  // harness-specific startCwd extraction (unchanged)
  const startCwd = /* ... */;
  await runLintTick(startCwd, '<harness>:kb-lint-tick');
}
```

Remove imports that are no longer used in the hook file: `runLint`, `lintStateFile`, `readLintState`, `writeLintState`, `resolveSettings`. Keep `findRepoRoot`, `repoPaths`, `appendHookDiagnostic`, `readStdin` (still needed for the parse-error path).

### Step 5: Build and test

```
npm run build
npm test
```

</details>
