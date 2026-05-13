---
id: 3
group: "init-scaffolding"
dependencies: [2]
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - unit-testing
---
# Remove husky / secretlint scaffolding from `init`

## Objective

Delete the `init`-time scaffolding that patches consumer `package.json` files with husky/lint-staged/secretlint, deletes the related templates, drops the no-`package.json` hard error, and removes the doctor checks that exist solely to verify that scaffolding (`checkCommitTimeSecretScan`, `checkSecretlint`). Add an integration test proving `init` succeeds in a fixture repo with no `package.json`.

## Skills Required

- `typescript`: deletions in `src/commands/init.ts`, `src/commands/doctor.ts`, `src/lib/paths.ts`.
- `unit-testing`: rewrite affected tests and add the no-`package.json` integration test.

## Acceptance Criteria

- [ ] `src/commands/init.ts` no longer contains: `installCommitScan`, `patchPackageJsonForScan`, `packageJsonNeedsScanScaffold`, `SECRET_SCAN_DEV_DEPS`, `LINT_STAGED_RC`, `CommitScanPathsForInit`.
- [ ] Both call sites of `installCommitScan` (`init.ts:87` and the upgrade path at `init.ts:209`) are removed.
- [ ] The "no `package.json` at repo root" hard error is gone; `runInit` proceeds when `package.json` is absent.
- [ ] `init`'s "Next steps" log no longer mentions `.secretlintrc.json`, `.husky/`, or the `npm install` step needed to activate husky.
- [ ] `templates/husky/` and `templates/secret-scan/` directories are deleted.
- [ ] `src/commands/doctor.ts` no longer contains `checkCommitTimeSecretScan` or `checkSecretlint` (verify no other call sites first via grep).
- [ ] `src/lib/paths.ts` no longer declares `secretlintrcFile`, `huskyDir`, `huskyPreCommitFile`, `lintstagedrcFile`, `packageJsonFile` if they have no remaining consumers (verify by grep before deleting; keep any that are still referenced elsewhere).
- [ ] Affected tests are deleted or rewritten so the suite matches the trimmed surface.
- [ ] A new Vitest integration test asserts that `runInit` in a fixture without `package.json` succeeds and produces no `.husky/`, `.secretlintrc.json`, or `.lintstagedrc.cjs` artefacts.
- [ ] `npm run build && npm test` pass.
- [ ] `grep -rn "installCommitScan\|patchPackageJsonForScan\|SECRET_SCAN_DEV_DEPS\|LINT_STAGED_RC\|checkCommitTimeSecretScan\|checkSecretlint" src tests templates` returns no results.

## Technical Requirements

- TypeScript edits in `init.ts`, `doctor.ts`, `paths.ts`.
- Directory deletes for `templates/husky/` and `templates/secret-scan/`.
- Vitest integration test using a temp directory without `package.json`.

## Input Dependencies

- Task 2: `init.ts` is already in a trimmed state (preflight removed), reducing merge risk.

## Output Artifacts

- Further-trimmed `src/commands/init.ts`.
- Removed husky/secretlint template directories.
- Trimmed `src/commands/doctor.ts` (without the two scan-related checks).
- Updated `src/lib/paths.ts` with unused path entries removed.
- New init-without-`package.json` integration test.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. In `src/commands/init.ts`:
   - Delete `installCommitScan` (around 502-543), `patchPackageJsonForScan` (545-574), `packageJsonNeedsScanScaffold` (576-591), `SECRET_SCAN_DEV_DEPS` (482-487), `LINT_STAGED_RC` (489-500), and the `CommitScanPathsForInit` interface.
   - Remove the two call sites (`init.ts:87` and the upgrade path around `init.ts:209`).
   - Locate the "No package.json at repo root" hard error and delete it. Confirm `runInit` no longer reads `package.json` for scaffolding purposes; if `package.json` content is read only for the scan setup, drop that read entirely.
   - Update the "Next steps" log block (around `init.ts:108-112`) to remove references to `.secretlintrc.json`, `.husky/`, and the `npm install` activation step.
2. Delete `templates/husky/` and `templates/secret-scan/` (use `rm -rf` via Bash). Confirm no other code path references them via `grep -rn "templates/husky\|templates/secret-scan" src`.
3. In `src/commands/doctor.ts`:
   - Remove `checkCommitTimeSecretScan` and its registration in the checks list.
   - Verify (via grep) that `checkSecretlint` is only invoked by `doctor.ts`. If yes, remove it as well; its sole purpose was to verify the scaffolding from this task.
4. In `src/lib/paths.ts`:
   - For each candidate field (`secretlintrcFile`, `huskyDir`, `huskyPreCommitFile`, `lintstagedrcFile`, `packageJsonFile`), grep `src tests` for remaining references. Delete only the ones with no remaining consumers. Leave any still needed.
5. Audit `tests/`:
   - Grep for `installCommitScan`, `patchPackageJsonForScan`, `.husky`, `.secretlintrc`, `.lintstagedrc`, `checkCommitTimeSecretScan`, `checkSecretlint`. Delete or rewrite each affected test.
6. Add the integration test in `tests/init.test.ts`:
   - Create a temp directory with no `package.json`.
   - Run `runInit({ ... assistants: ['claude'] })`.
   - Assert the call resolves successfully.
   - Assert `.ai/knowledge-base/` and `.claude/` exist; `.husky/`, `.secretlintrc.json`, `.lintstagedrc.cjs` do not exist.
   - Clean up in `afterEach`.
7. Run `npm run build && npm test` and fix any breakage.
8. Run the stale-reference grep from the acceptance criteria; confirm zero hits.

</details>
