---
id: 1
group: "adapter-removal"
dependencies: []
status: "completed"
created: 2026-05-13
skills: ["typescript"]
---
# Dissolve the Adapter Abstraction

## Objective
Delete the `Adapter` interface and `ClaudeAdapter` class. Relocate `writeHookConfig` as a free function in `src/lib/hooks-config.ts`. Replace the three production call sites (`init`, `curate`, `bootstrap-incremental`) with direct calls to the free function and `runHeadlessClaude`. Rewrite the adapter tests as targeted tests of the relocated free function.

## Skills Required
- `typescript`: refactor file structure, move type/interface declarations, update imports across multiple call sites.

## Acceptance Criteria
- [ ] `src/adapters/types.ts` and `src/adapters/claude.ts` are deleted. The `src/adapters/` directory no longer exists.
- [ ] `src/lib/hooks-config.ts` exists and exports `writeClaudeHookConfig(repoRoot: string, hooks: HookSpec[]): Promise<void>`, along with `HookEvent` and `HookSpec` types.
- [ ] `src/commands/init.ts` imports `writeClaudeHookConfig` and calls it directly (no `ClaudeAdapter` instance).
- [ ] `src/commands/curate.ts` imports `runHeadlessClaude` from `src/lib/headless.js` and passes it (or a thin wrapper) to `runCurate` instead of going through `ClaudeAdapter`.
- [ ] `src/commands/bootstrap-incremental.ts` imports `runHeadlessClaude` from `src/lib/headless.js` and passes it to `runBootstrapIncremental` instead of going through `ClaudeAdapter`.
- [ ] `tests/adapters/claude.test.ts` is deleted. Its hook-merging coverage is preserved in a new `tests/lib/hooks-config.test.ts` that exercises `writeClaudeHookConfig` directly (the `kb-` owned-prefix replacement, preservation of foreign hooks, and empty-event cleanup).
- [ ] The stale comment about `ClaudeAdapter constructor seam` in `tests/lib/conflicts.test.ts:182-188` is updated or removed so it does not reference the deleted class.
- [ ] `grep -rn "ClaudeAdapter\|\\bAdapter\\b\|HeadlessOpts\|SkillSpec\|hookInstallPath\|skillInstallPath\|readTranscript\|renderSkill" src/ tests/` returns no hits.
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript, Node ESM imports (the project uses `.js` extensions for relative imports under TS).
- The relocated function `writeClaudeHookConfig` keeps the existing semantics exactly: parse-or-init `.claude/settings.json`, scrub previously-owned hooks identified by the `.claude/hooks/kb-` script-path prefix, then add the requested hooks; preserve foreign hooks and remove now-empty event entries.
- The new file must be `src/lib/hooks-config.ts` (sibling of `src/lib/headless.ts`, `src/lib/index-gen.ts`).

## Input Dependencies
None.

## Output Artifacts
- New file `src/lib/hooks-config.ts` (free function + types).
- New file `tests/lib/hooks-config.test.ts` (replaces the deleted adapter test for hook merging).
- Updated call sites: `src/commands/init.ts`, `src/commands/curate.ts`, `src/commands/bootstrap-incremental.ts`.
- Deletion of `src/adapters/` and `tests/adapters/claude.test.ts`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Create `src/lib/hooks-config.ts`** with the following content (ported directly from `src/adapters/claude.ts` plus type definitions from `src/adapters/types.ts`). Keep behavior identical:

   ```ts
   import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
   import { dirname, join } from 'node:path';

   export type HookEvent = 'Stop' | 'SessionEnd' | 'PreCompact' | 'SessionStart' | 'UserPromptSubmit';

   export interface HookSpec {
     event: HookEvent;
     scriptPath: string;
     matcher?: string;
     async?: boolean;
   }

   interface ClaudeSettings {
     hooks?: Record<
       string,
       Array<{ matcher?: string; hooks: Array<{ type: string; command: string; async?: boolean }> }>
     >;
     [key: string]: unknown;
   }

   const HOOK_INSTALL_PATH = '.claude/hooks';

   /**
    * Merges hook entries into `.claude/settings.json`. Existing user-defined
    * hooks are preserved; entries previously written by us are recognized by
    * the `.claude/hooks/kb-` script-path prefix and replaced wholesale.
    */
   export async function writeClaudeHookConfig(repoRoot: string, hooks: HookSpec[]): Promise<void> {
     const settingsFile = join(repoRoot, '.claude/settings.json');
     let settings: ClaudeSettings = {};
     if (existsSync(settingsFile)) {
       try {
         settings = JSON.parse(readFileSync(settingsFile, 'utf8')) as ClaudeSettings;
       } catch (err) {
         throw new Error(`Could not parse existing ${settingsFile}: ${(err as Error).message}`);
       }
     }
     settings.hooks ??= {};

     const ownedPrefix = `${HOOK_INSTALL_PATH}/kb-`;
     for (const [event, entries] of Object.entries(settings.hooks)) {
       const filtered = entries
         .map(entry => ({
           ...entry,
           hooks: entry.hooks.filter(h => !h.command.includes(ownedPrefix)),
         }))
         .filter(entry => entry.hooks.length > 0);
       if (filtered.length === 0) delete settings.hooks[event];
       else settings.hooks[event] = filtered;
     }

     for (const hook of hooks) {
       const entryList = (settings.hooks[hook.event] ??= []);
       const command = `node "$CLAUDE_PROJECT_DIR/${hook.scriptPath}"`;
       const entry: {
         matcher?: string;
         hooks: Array<{ type: string; command: string; async?: boolean }>;
       } = {
         hooks: [{ type: 'command', command, ...(hook.async ? { async: true } : {}) }],
       };
       if (hook.matcher) entry.matcher = hook.matcher;
       entryList.push(entry);
     }

     mkdirSync(dirname(settingsFile), { recursive: true });
     writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
   }
   ```

2. **Update `src/commands/init.ts`**:
   - Remove `import { ClaudeAdapter } from '../adapters/claude.js';`
   - Add `import { writeClaudeHookConfig } from '../lib/hooks-config.js';`
   - In `installClaude`, replace `const adapter = new ClaudeAdapter();` and `await adapter.writeHookConfig(root, [...])` with `await writeClaudeHookConfig(root, [...])`. The list of hooks passed remains unchanged.

3. **Update `src/commands/curate.ts`**:
   - Remove `import { ClaudeAdapter } from '../adapters/claude.js';`
   - Add `import { runHeadlessClaude, type RunHeadlessOptions } from '../lib/headless.js';`
   - Replace the `adapter` instance and the `runner` definition with a runner that calls `runHeadlessClaude` directly. Because `CuratorRunner` is typed in `src/lib/curate.ts` with a specific `opts` shape (`timeoutMs`, optional `allowedTools`, `logFile`, `model`, `effort`, `onMessage`), pass that opts object through to `runHeadlessClaude` after coercing it to `RunHeadlessOptions`. Suggested replacement:
     ```ts
     const runner: CuratorRunner = (prompt, stdin, schema, runnerOpts) =>
       runHeadlessClaude(prompt, stdin, schema, runnerOpts as RunHeadlessOptions);
     ```
     Verify the field shapes match between `CuratorRunner`'s opts and `RunHeadlessOptions` (they do: same keys, same optionality).

4. **Update `src/commands/bootstrap-incremental.ts`**: identical pattern to `curate.ts`. The `BootstrapRunner` type lives in `src/lib/bootstrap.ts`; the runner becomes:
   ```ts
   const runner: BootstrapRunner = (prompt, stdin, schema, runnerOpts) =>
     runHeadlessClaude(prompt, stdin, schema, runnerOpts as RunHeadlessOptions);
   ```

5. **Delete files**:
   - `rm src/adapters/types.ts src/adapters/claude.ts`
   - `rmdir src/adapters` (or `rm -rf src/adapters`)

6. **Replace `tests/adapters/claude.test.ts` with `tests/lib/hooks-config.test.ts`**:
   - Delete the file under `tests/adapters/` and remove the empty directory: `rm tests/adapters/claude.test.ts && rmdir tests/adapters`.
   - The existing tests cover only `skillInstallPath`, `hookInstallPath`, and `renderSkill` (all of which are being removed). There is no existing test of `writeHookConfig` to port verbatim. **Write new tests** in `tests/lib/hooks-config.test.ts` for the merge logic, covering:
     - Empty/missing `.claude/settings.json` is created with the supplied hooks.
     - Existing foreign hooks (commands not containing `.claude/hooks/kb-`) are preserved.
     - Existing `kb-*` hooks are scrubbed before new ones are written.
     - An event entry whose only hooks were `kb-*` gets cleaned up (the event key is removed entirely) before the new hooks are added.
     - `async: true` is emitted only when the spec sets it.
   - Use `mkdtempSync` from `node:fs` with `tmpdir()` for a temp repo root, similar to other test files (see `tests/lib/state.test.ts` or `tests/init.test.ts` for patterns).

7. **Update `tests/lib/conflicts.test.ts`**: the comment block at line 182 references `ClaudeAdapter constructor seam`. Replace it with a comment that no longer mentions the deleted class. Suggested rewrite: replace the block from `// Mock the curator runner via the ClaudeAdapter constructor seam isn't easy;` through `// pending — actually that won't produce conflicts. We exercise the` with:
   ```ts
   // Mocking the curator runner from outside isn't easy; instead, exercise
   // the pending-conflicts file shape via the `no-pending` branch (always
   ```
   so the surrounding code still reads correctly.

8. **Verify**:
   - `rg -n "ClaudeAdapter|\\bAdapter\\b|adapters/claude|adapters/types|HeadlessOpts|SkillSpec|hookInstallPath|skillInstallPath|readTranscript|renderSkill" src/ tests/` returns no hits.
   - `ls src/adapters/ 2>/dev/null` returns nothing (directory absent).
   - `npx tsc --noEmit` exits 0.
   - `npm test` exits 0.

</details>
