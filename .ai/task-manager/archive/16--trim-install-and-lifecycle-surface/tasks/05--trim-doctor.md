---
id: 5
group: "doctor"
dependencies: [1, 3]
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - unit-testing
---
# Trim `doctor` to the acceptance-criteria minimum

## Objective

Collapse `checkInstalledVersion` + `checkInstalledVersionCurrent` into one `checkInstalled` returning a single `CheckResult`; remove `EXPECTED_HOOK_SCRIPTS` and rewrite `checkClaudeHooks` to derive its expected entries from `src/lib/hook-spec.ts`; remove `unquotedTimestampHint` from `src/lib/nodes.ts` `formatIssue` (and the doctor caller adapts to the simpler message). Keep every other check that the plan preserves (Node version, claude CLI, gitignore, INDEX freshness, settings, prompts, frontmatter, dangling derived_from, `--verbose`).

## Skills Required

- `typescript`: refactor `src/commands/doctor.ts` and `src/lib/nodes.ts`.
- `unit-testing`: rewrite tests that pinned the old two-check behavior or the `unquotedTimestampHint` text.

## Acceptance Criteria

- [ ] `src/commands/doctor.ts` defines one combined `checkInstalled`:
  - missing `installed-version` file → error result (with the existing "run `init`" hint).
  - file present + version matches → ok result.
  - file present + version drift → warn result (with the existing upgrade hint).
- [ ] The original `checkInstalledVersion` and `checkInstalledVersionCurrent` are gone; only one `checks.push(...)` covers them.
- [ ] `EXPECTED_HOOK_SCRIPTS` is deleted. `checkClaudeHooks` iterates `HOOK_SPECS` from `src/lib/hook-spec.ts` and asserts both (a) the entry exists in `.claude/settings.json` and (b) the script file exists under `.claude/hooks/`.
- [ ] `unquotedTimestampHint` is removed from `src/lib/nodes.ts`'s `formatIssue`; the caller in `doctor.ts` uses the simplified Zod message directly.
- [ ] `--verbose` mode still works for the frontmatter and dangling-ref listings (no behavior change there).
- [ ] `wc -l src/commands/doctor.ts` shows the file in the 150-250 line range (per the plan's Self Validation step 7).
- [ ] Tests that asserted the old two-check installed-version output or the `unquotedTimestampHint` text are rewritten.
- [ ] `npm run build && npm test` pass.
- [ ] `grep -rn "EXPECTED_HOOK_SCRIPTS\|unquotedTimestampHint" src tests` returns no results.

## Technical Requirements

- TypeScript edits in `src/commands/doctor.ts` and `src/lib/nodes.ts`.
- Vitest test updates in `tests/doctor.test.ts` and any nodes-format tests.

## Input Dependencies

- Task 1: `src/lib/hook-spec.ts` exists so `checkClaudeHooks` can import `HOOK_SPECS`.
- Task 3: `checkCommitTimeSecretScan` (and likely `checkSecretlint`) have already been removed; this task does not re-introduce them.

## Output Artifacts

- Trimmed `src/commands/doctor.ts` (target 150-250 lines).
- Updated `src/lib/nodes.ts` with `unquotedTimestampHint` removed.
- Updated `tests/doctor.test.ts`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. In `src/commands/doctor.ts`:
   - Locate `checkInstalledVersion` and `checkInstalledVersionCurrent`. Replace them with a single `checkInstalled` returning one `CheckResult`. Reuse the existing message strings so the user-facing output is essentially unchanged for the three states.
   - Remove the second `checks.push` for the version-current check.
   - Locate `EXPECTED_HOOK_SCRIPTS` (around `doctor.ts:326-331`) and delete it. Inside `checkClaudeHooks`, iterate `HOOK_SPECS` from `src/lib/hook-spec.ts`. For each spec entry, assert it appears in the read `.claude/settings.json` and that `path.join(claudeHooksDir, spec.scriptPath)` exists. Preserve the existing error/warn level on each failure type.
2. In `src/lib/nodes.ts`:
   - Locate `formatIssue` and remove the `unquotedTimestampHint` branch. Return the underlying Zod message (or the existing default) directly. Confirm no other code path depends on the removed text.
3. Re-run `wc -l src/commands/doctor.ts` and confirm the file lands in 150-250 lines. If above 250, look for any remaining helper that exists only for the now-removed checks (e.g., helpers used solely by `checkCommitTimeSecretScan`/`checkSecretlint` that survived Task 3) and delete them.
4. Audit `tests/`:
   - `grep -rn "checkInstalledVersionCurrent\|EXPECTED_HOOK_SCRIPTS\|unquotedTimestampHint" tests` and rewrite each affected test to match the new shape.
   - Update doctor test fixtures that compare against the old two-line installed-version output to match the new single line.
5. Run `npm run build && npm test`. Run the stale-reference grep.

</details>
