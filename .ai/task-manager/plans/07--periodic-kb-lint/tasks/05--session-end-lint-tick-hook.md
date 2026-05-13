---
id: 5
group: "hook"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# SessionEnd lint-tick hook + bundle + init/doctor wiring

## Objective

Add the `kb-lint-tick` SessionEnd async hook that increments a session counter on every fire and, when the counter reaches `lintEveryNSessions`, runs the lint library and writes the summary to `lint-state.json`. Bundle it via tsup, register it in `init`/`upgrade` via `ClaudeAdapter.writeHookConfig`, and extend `doctor`'s `EXPECTED_HOOK_SCRIPTS` so doctor verifies the wiring.

## Skills Required

- typescript: hook script in the existing pattern, build-config edit, doctor/init wiring edits.

## Acceptance Criteria

- [ ] New file `src/hooks/kb-lint-tick.ts` follows the structure of `src/hooks/kb-proposal-drain.ts` (async hook, recursion guard, JSON stdin parsing, repo-root resolution, try/catch swallowing errors to stderr).
- [ ] Behavior: read stdin (best-effort), resolve `repoPaths`, short-circuit if `installedVersionFile` does not exist or if `KB_BUILDER_INTERNAL=1`. Read settings via `resolveSettings({ projectFile: paths.projectConfigFile })`. Compute `threshold = settings.lintEveryNSessions` (always present because the defaults table guarantees it). Read lint state via `readLintState(lintStateFile(paths.stateDir))`. Compute `nextCount = state.sessions_since_last_lint + 1`.
  - If `nextCount < threshold`: write `{...state, sessions_since_last_lint: nextCount}` and exit silently.
  - If `nextCount >= threshold`: run `runLint({ nodesDir: paths.nodesDir })`, write `{ schema_version: 1, sessions_since_last_lint: 0, last_lint_at: new Date().toISOString(), last_errors: result.errors.length, last_findings: result.findings.length }` and exit silently.
- [ ] Failure mode: any thrown error from `readAllNodes` or filesystem is caught at top level and emits a single stderr line `[ai-knowledge-base] lint tick error: <message>`. The hook never throws into the host process. Exits 0 in all paths.
- [ ] `tsup.config.ts`: the second build entry block gains `'kb-lint-tick': 'src/hooks/kb-lint-tick.ts'` so the bundle produces `dist/hooks/kb-lint-tick.mjs`.
- [ ] `src/commands/init.ts`: the `installClaude` hook-registration array passed to `adapter.writeHookConfig` includes a new entry `{ event: 'SessionEnd', scriptPath: '.claude/hooks/kb-lint-tick.mjs', async: true }`. This is in addition to the existing capture entry on the same event; both must persist after init/upgrade.
- [ ] `src/commands/doctor.ts`: `EXPECTED_HOOK_SCRIPTS.SessionEnd` is extended to include `'.claude/hooks/kb-lint-tick.mjs'` so doctor checks both registration and presence of the script file.
- [ ] After `npm run build`, `templates/claude/hooks/kb-lint-tick.mjs` exists (the build script copies built hooks into templates).
- [ ] `npm run typecheck` is clean.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Reference hook: `src/hooks/kb-proposal-drain.ts`. Mirror: top-level `void main().catch(() => process.exit(0))`, async stdin reader, recursion guard via `KB_BUILDER_INTERNAL`, short-circuit on missing `installedVersionFile`, stderr-tagged error logging.
- Reference build entry: see `tsup.config.ts` hooks block. Add the new key/value next to the existing three keys.
- Reference init wiring: see `src/commands/init.ts` `installClaude` (around line 431). Insert a new entry into the array passed to `adapter.writeHookConfig`.
- Reference doctor wiring: see `src/commands/doctor.ts` `EXPECTED_HOOK_SCRIPTS` (around line 326). Append the new script under the `SessionEnd` key.
- The build script that mirrors `dist/hooks/*.mjs` into `templates/claude/hooks/*.mjs` is a separate package script (`scripts/build-templates.cjs` or similar). Confirm by inspecting `package.json` scripts. If the templating step is manual, document the required follow-up; otherwise nothing extra is needed.

## Input Dependencies

- Task 1: `lintEveryNSessions` exists on `EffectiveSettings`.
- Task 2: `runLint` library exists.
- Task 3: `readLintState`, `writeLintState`, `lintStateFile`, `DEFAULT_LINT_STATE`.

## Output Artifacts

- `src/hooks/kb-lint-tick.ts`.
- Edited `tsup.config.ts`.
- Edited `src/commands/init.ts`.
- Edited `src/commands/doctor.ts`.
- Built (after `npm run build`) `dist/hooks/kb-lint-tick.mjs` and `templates/claude/hooks/kb-lint-tick.mjs`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Create `src/hooks/kb-lint-tick.ts`. Use this skeleton (modeled on `kb-proposal-drain.ts`):

   ```ts
   import { existsSync } from 'node:fs';
   import { runLint } from '../lib/lint.js';
   import { lintStateFile, readLintState, writeLintState } from '../lib/lint-state.js';
   import { findRepoRoot, repoPaths } from '../lib/paths.js';
   import { resolveSettings } from '../lib/settings.js';

   const PACKAGE_TAG = '[ai-knowledge-base]';

   async function main(): Promise<void> {
     if (process.env['KB_BUILDER_INTERNAL'] === '1') return;

     const raw = await readStdin();
     let input: { cwd?: unknown } = {};
     if (raw.trim().length > 0) {
       try { input = JSON.parse(raw) as { cwd?: unknown }; } catch { input = {}; }
     }
     const startCwd =
       typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : process.cwd();
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

       const result = runLint({ nodesDir: paths.nodesDir });
       writeLintState(stateFile, {
         schema_version: 1,
         sessions_since_last_lint: 0,
         last_lint_at: new Date().toISOString(),
         last_errors: result.errors.length,
         last_findings: result.findings.length,
       });
     } catch (err) {
       process.stderr.write(
         `${PACKAGE_TAG} lint tick error: ${err instanceof Error ? err.message : String(err)}\n`
       );
     }
   }

   function readStdin(): Promise<string> {
     return new Promise(resolve => {
       if (process.stdin.isTTY) { resolve(''); return; }
       let data = '';
       process.stdin.setEncoding('utf8');
       process.stdin.on('data', (chunk: string) => { data += chunk; });
       process.stdin.on('end', () => resolve(data));
       process.stdin.on('error', () => resolve(''));
     });
   }

   void main().catch(() => process.exit(0));
   ```

2. Edit `tsup.config.ts`. In the second config block (hooks), under `entry:` add the line:

   ```ts
   'kb-lint-tick': 'src/hooks/kb-lint-tick.ts',
   ```

   alongside `'kb-capture'`, `'kb-proposal-drain'`, `'kb-session-start'`.

3. Edit `src/commands/init.ts`. In `installClaude` (around line 431), inside the array passed to `adapter.writeHookConfig`, add (place it after the existing `SessionEnd` capture entry):

   ```ts
   { event: 'SessionEnd', scriptPath: '.claude/hooks/kb-lint-tick.mjs', async: true },
   ```

4. Edit `src/commands/doctor.ts`. Update `EXPECTED_HOOK_SCRIPTS` (around line 326):

   ```ts
   SessionEnd: ['.claude/hooks/kb-capture.mjs', '.claude/hooks/kb-lint-tick.mjs'],
   ```

5. Check `package.json` for the script that publishes `dist/hooks/*.mjs` into `templates/claude/hooks/`. If a `build:templates` (or similar) step exists, run `npm run build` and confirm `templates/claude/hooks/kb-lint-tick.mjs` is produced. If the script does not automatically copy, look at how the existing three hooks ended up in `templates/claude/hooks/`. The plan assumes this is automatic; verify before declaring the task complete.

6. Manual smoke (optional during implementation; the test task covers it formally): in a sandbox, write `lintEveryNSessions: 1` to `config.yaml`, ensure `installedVersionFile` exists, and run `node .claude/hooks/kb-lint-tick.mjs < /dev/null`. The first run should create `.state/lint-state.json` with `last_errors` and `last_findings` populated and the counter reset.

7. Avoid em-dashes in any comment, log line, or commit message. Use commas, colons, or parentheses.

</details>
