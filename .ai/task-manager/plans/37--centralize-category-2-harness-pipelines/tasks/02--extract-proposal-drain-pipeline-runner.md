---
id: 2
group: "pipeline-extraction"
dependencies: []
status: completed
created: 2026-05-26
skills:
  - typescript-modules
---
# Extract proposal-drain pipeline runner into src/lib/proposal-drain.ts

## Objective

Add `runProposalDrain()` to `src/lib/proposal-drain.ts` that encapsulates the binary-availability check, stdin parse, path resolution, prompt load, `drainProposalQueue()` call, and status logging. Replace the near-identical pipeline bodies in `codex/hooks/kb-proposal-drain.ts`, `cursor/hooks/kb-proposal-drain.ts`, and `opencode/hooks/kb-proposal-drain.ts` with a thin call to this function. `loadProposalPrompt` is already exported from `src/lib/proposal-drain.ts` — do not re-extract it.

## Skills Required

- TypeScript ESM module authoring and import management

## Acceptance Criteria

- [ ] `runProposalDrain(opts: ProposalDrainOpts): Promise<void>` is exported from `src/lib/proposal-drain.ts`
- [ ] `grep -n "drainProposalQueue" src/harnesses/codex/hooks/kb-proposal-drain.ts` returns zero matches (call is now in lib)
- [ ] `grep -n "drainProposalQueue" src/harnesses/cursor/hooks/kb-proposal-drain.ts` returns zero matches
- [ ] `grep -n "drainProposalQueue" src/harnesses/opencode/hooks/kb-proposal-drain.ts` returns zero matches
- [ ] `npm run build` succeeds with no new errors
- [ ] `npm test` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- New interface and function in `src/lib/proposal-drain.ts`:
  ```typescript
  export interface ProposalDrainOpts {
    binaryName: string;
    startCwd: string;
    runner: ProposalRunner;
    harnessOpts: Record<string, unknown>;
    harnessTag: string;  // e.g. 'codex:kb-proposal-drain', used for appendHookDiagnostic
  }
  export async function runProposalDrain(opts: ProposalDrainOpts): Promise<void>
  ```
- The function body encapsulates (in order):
  1. `execFileSync('which', [opts.binaryName], { stdio: 'ignore' })` — returns silently if binary is missing
  2. `findRepoRoot(opts.startCwd)` + `repoPaths(root)` + `installedVersionFile` guard
  3. `loadProposalPrompt(paths.promptsDir)` — already in lib, import it internally
  4. `resolveSettings(...)` + `drainProposalQueue(...)` call
  5. Locked / failed status logging to stderr
- Each harness hook's `main()` is reduced to: read stdin → extract `startCwd` using its harness-specific input-shape idiom → call `runProposalDrain({ binaryName, startCwd, runner, harnessOpts, harnessTag })`
- The `execFileSync` import moves into `src/lib/proposal-drain.ts`; it can be removed from the hook files if no longer needed there
- `harnessOpts` type is `Record<string, unknown>` at the lib boundary; the harness builds it with its typed builder and passes it down

## Input Dependencies

None — this task has no dependencies. (`loadProposalPrompt` is already exported from `src/lib/proposal-drain.ts` as confirmed by the existing exports.)

## Output Artifacts

- Modified `src/lib/proposal-drain.ts` with `ProposalDrainOpts` interface and `runProposalDrain()` added and exported
- Modified `src/harnesses/codex/hooks/kb-proposal-drain.ts`
- Modified `src/harnesses/cursor/hooks/kb-proposal-drain.ts`
- Modified `src/harnesses/opencode/hooks/kb-proposal-drain.ts`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Step 1: Read the three hooks

Read each of the three proposal-drain hooks to confirm the current structure. After plan 36's changes, they already import `readStdin` from lib and `loadProposalPrompt` from lib. Verify the remaining pipeline is identical (it should be, modulo the binary name and runner/opts builder).

The per-harness differences are:
- Codex: `binaryName = 'codex'`, runner = `runHeadlessCodex`, opts = `buildCodexHarnessOpts(settings, 'proposal')`
- Cursor: `binaryName = 'agent'`, runner = `runHeadlessCursor`, opts = `buildCursorHarnessOpts(settings, 'proposal')`
- OpenCode: `binaryName = 'opencode'`, runner = `runHeadlessOpenCode`, opts = `buildOpenCodeHarnessOpts(settings, 'proposal')`
- Cursor input shape: `{ workspace_roots?: unknown }` → `roots[0]`; Codex and OpenCode: `{ cwd?: unknown }`

Note: the `startCwd` extraction (the harness-specific cwd idiom) stays in the hook because it is a warranted Category 4 difference.

### Step 2: Add `ProposalDrainOpts` and `runProposalDrain()` to `src/lib/proposal-drain.ts`

Add the following at the end of `src/lib/proposal-drain.ts`:

```typescript
import { execFileSync } from 'node:child_process';
// (add to existing imports if not already present)

export interface ProposalDrainOpts {
  binaryName: string;
  startCwd: string;
  runner: ProposalRunner;
  harnessOpts: Record<string, unknown>;
  harnessTag: string;
}

export async function runProposalDrain(opts: ProposalDrainOpts): Promise<void> {
  const PACKAGE_TAG = '[ai-knowledge-base]';
  try {
    execFileSync('which', [opts.binaryName], { stdio: 'ignore' });
  } catch {
    return;
  }

  const root = findRepoRoot(opts.startCwd);
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) return;

  const promptTemplate = loadProposalPrompt(paths.promptsDir);
  if (!promptTemplate) {
    process.stderr.write(`${PACKAGE_TAG} proposal prompt template not found; skipping drain\n`);
    return;
  }

  try {
    process.stderr.write('🔄 KB Proposals: Draining queue…\n');
    const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
    const summary = await drainProposalQueue({
      paths,
      promptTemplate,
      runner: opts.runner,
      harnessOpts: opts.harnessOpts,
    });
    if (summary.status === 'locked') {
      process.stderr.write('🔒 KB Proposals: Drain already in progress.\n');
      return;
    }
    const failed = summary.processed.filter(p => p.status === 'failed');
    if (failed.length > 0) {
      process.stderr.write(
        `${PACKAGE_TAG} proposal drain: ${failed.length} session(s) failed; see _logs/proposal/\n`
      );
    }
    process.stderr.write('📬 KB Proposals: Queue drained.\n');
  } catch (err) {
    process.stderr.write(
      `${PACKAGE_TAG} proposal drain error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }
}
```

`findRepoRoot`, `repoPaths`, `existsSync`, `resolveSettings` are already imported at the top of `proposal-drain.ts`; verify and add any that are missing.

### Step 3: Update each hook to call `runProposalDrain()`

For each of the three hooks, the `main()` function becomes:

**Codex** (`binaryName = 'codex'`):
```typescript
async function main(): Promise<void> {
  if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

  const raw = await readStdin();
  let input: { cwd?: unknown } = {};
  if (raw.trim().length > 0) {
    try {
      input = JSON.parse(raw) as { cwd?: unknown };
    } catch (err) {
      const paths = repoPaths(findRepoRoot(process.cwd()));
      appendHookDiagnostic('codex:kb-proposal-drain', 'parse', err, paths.logsDir);
      input = {};
    }
  }
  const startCwd =
    typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
  const { settings } = resolveSettings({ projectFile: repoPaths(findRepoRoot(startCwd)).projectConfigFile });
  await runProposalDrain({
    binaryName: 'codex',
    startCwd,
    runner: async (prompt, stdin, schema, opts) => runHeadlessCodex(prompt, stdin, schema, opts),
    harnessOpts: buildCodexHarnessOpts(settings, 'proposal'),
    harnessTag: 'codex:kb-proposal-drain',
  });
}
```

**Important**: `resolveSettings` needs `paths.projectConfigFile`, which requires `findRepoRoot(startCwd)`. The hook should call `findRepoRoot` + `repoPaths` once to get `paths`, then pass `settings` or call `runProposalDrain` which internally does its own `findRepoRoot`. To avoid double resolution: let `runProposalDrain` handle all of that internally — the hook only needs to pass `startCwd`. Remove `resolveSettings` from the hook entirely if it's only used to build `harnessOpts`.

Actually, re-examine: `buildCodexHarnessOpts(settings, 'proposal')` requires `settings`. If `runProposalDrain` internalizes settings resolution, the hook doesn't need it. The cleanest approach: pass the harness opts builder as a callback, or resolve settings inside `runProposalDrain` and pass `harnessOpts` as a factory. Choose the simplest: move `resolveSettings` inside `runProposalDrain` (it already is in the current inline code), and have the hook pass a `buildHarnessOpts: (settings: Settings) => Record<string, unknown>` callback instead.

Revise the interface:
```typescript
export interface ProposalDrainOpts {
  binaryName: string;
  startCwd: string;
  runner: ProposalRunner;
  buildHarnessOpts: (settings: ReturnType<typeof resolveSettings>['settings']) => Record<string, unknown>;
  harnessTag: string;
}
```

Then inside `runProposalDrain`, call `resolveSettings` once and pass `buildHarnessOpts(settings)` to `drainProposalQueue`. This keeps the hook simple:

```typescript
await runProposalDrain({
  binaryName: 'codex',
  startCwd,
  runner: async (prompt, stdin, schema, opts) => runHeadlessCodex(prompt, stdin, schema, opts),
  buildHarnessOpts: (settings) => buildCodexHarnessOpts(settings, 'proposal'),
  harnessTag: 'codex:kb-proposal-drain',
});
```

Use whichever design is simpler after reading the actual Settings type. The important constraint is that the hook's `main()` body is clearly shorter than it currently is and the pipeline logic is no longer duplicated.

### Step 4: Build and test

```
npm run build
npm test
```

</details>
