---
id: 6
group: "nudge"
dependencies: [3]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Extend SessionStart nudge with a lint summary block

## Objective

When `lint-state.json` shows non-zero `last_errors` or `last_findings`, append a single-line nudge to the `additionalContext` produced by `buildSessionStartContext`. The nudge names the date and counts, and prescribes the CLI command (`ai-knowledge-base lint`). The existing `last_nudged_at` throttle does NOT gate this block (per the plan: lint findings are infrequent and high-signal).

## Skills Required

- typescript: extend an existing pure-ish builder in `src/lib/session-start.ts`; thread a new path through `kb-session-start.ts`.

## Acceptance Criteria

- [ ] `SessionStartContext` gains a new optional field `lintStateFile?: string`. When undefined, the lint block is skipped (preserves test-time injection without lint-state).
- [ ] `buildSessionStartContext`, after deciding `shouldNudge`, reads the lint state (`readLintState(ctx.lintStateFile)`) when the field is provided. If the read returns `last_errors > 0 || last_findings > 0`, append a blank line and a single line of the form:

  `> Last KB lint ${last_lint_at}: ${last_errors} error(s), ${last_findings} finding(s). Run \`ai-knowledge-base lint --verbose\` for details.`

- [ ] When `last_errors === 0 && last_findings === 0` (including the default-state case), no lint block is appended.
- [ ] `SessionStartResult` gains a new boolean `lintNudged: boolean` reflecting whether the lint block was appended this call.
- [ ] `src/hooks/kb-session-start.ts` passes `lintStateFile: lintStateFile(paths.stateDir)` into `buildSessionStartContext`.
- [ ] The block is rendered AFTER the existing curate nudge so the ordering is stable: INDEX body → optional stale-index notice → optional curate nudge → optional lint nudge.
- [ ] The lint nudge does NOT mutate `last_nudged_at` (the existing throttle stays scoped to the curate nudge).
- [ ] `npm run typecheck` is clean.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `src/lib/session-start.ts`. The function `buildSessionStartContext` already builds `lines: string[]`. Append the new block to `lines` after the existing curate-nudge branch.
- File: `src/hooks/kb-session-start.ts`. Inside the `buildSessionStartContext` call, add the new field.
- Import `readLintState` and `lintStateFile` from `../lib/lint-state.js` in `session-start.ts`; `lintStateFile` is just a path helper, so it may be simpler to import only `readLintState` and rely on the caller to pass an absolute path (already the case for `stateFile`). Use the same `ctx.lintStateFile` style.

## Input Dependencies

- Task 3: `readLintState` and `lintStateFile` exist.

## Output Artifacts

- Edited `src/lib/session-start.ts`.
- Edited `src/hooks/kb-session-start.ts`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. In `src/lib/session-start.ts`, add an import at the top:

   ```ts
   import { readLintState, DEFAULT_LINT_STATE } from './lint-state.js';
   ```

2. Extend the `SessionStartContext` interface:

   ```ts
   export interface SessionStartContext {
     kbDir: string;
     nodesDir: string;
     sessionsDir: string;
     stateFile: string;
     lintStateFile?: string;
     threshold?: number;
     throttleMs?: number;
     now?: () => Date;
   }
   ```

3. Extend `SessionStartResult` with `lintNudged: boolean`.

4. After the existing `shouldNudge` branch, before the `writeState` call, add:

   ```ts
   let lintNudged = false;
   if (ctx.lintStateFile !== undefined) {
     const lintState = readLintState(ctx.lintStateFile);
     if (lintState.last_errors > 0 || lintState.last_findings > 0) {
       lines.push('');
       lines.push(
         `> Last KB lint ${lintState.last_lint_at}: ${lintState.last_errors} error(s), ${lintState.last_findings} finding(s). Run \`ai-knowledge-base lint --verbose\` for details.`
       );
       lintNudged = true;
     }
   }
   ```

   Include `lintNudged` in the returned object.

5. The unused `DEFAULT_LINT_STATE` import can be dropped; `readLintState` already falls back internally. Keep imports minimal.

6. In `src/hooks/kb-session-start.ts`, locate the `buildSessionStartContext({...})` call (around line 50). Add `lintStateFile: lintStateFile(paths.stateDir)` to the object. Import `lintStateFile` from `../lib/lint-state.js`. (You can also pass the absolute path directly; either works.)

7. The plan explicitly states the lint nudge is acceptable to repeat per session because the user clears it by running the CLI (which writes a fresh, zero-count summary). Do NOT add throttling logic for the lint block.

8. No em-dashes. The example nudge sentence uses periods and colons.

</details>
