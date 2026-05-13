---
id: 2
group: "init-upgrade"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - unit-testing
---
# Strip upgrade preflight and `--dry-run` from `init`

## Objective

Delete the 11-variant `UpgradeChange` preflight, the `--dry-run` flag, and supporting helpers from `src/commands/init.ts` and `src/cli.ts`. Reduce `init --upgrade` to its existing apply steps with the existing preservation behavior (`copyPromptsPreservingLocal` skips existing files; `config.yaml` is written only when absent). Wire the centralized `hook-spec.ts` into the registration call site and add an integration test that proves an edited `config.yaml` and an edited prompt override survive `init --upgrade`.

## Skills Required

- `typescript`: substantial deletion across `init.ts`, plus replacing the inline hook list with imports from `hook-spec.ts`.
- `unit-testing`: rewrite tests that referenced the deleted preflight/dry-run surface and add the preservation integration test.

## Acceptance Criteria

- [ ] `src/commands/init.ts` no longer contains: `UpgradeChange` interface, `collectUpgradeChanges`, `inspectGitignore`, `hookRegistrationsNeedRefresh`, `filesEqual`, `skillDirsEqual`, `EXPECTED_HOOK_COMMANDS`, `GitignoreState`.
- [ ] `InitOptions` no longer has a `dryRun` field. The `runUpgrade` function no longer emits "Planned changes" output or has an early-return for dry-run.
- [ ] The `init` command in `src/cli.ts` no longer declares `--dry-run`.
- [ ] `installClaude` (and any other registration site) consumes `HOOK_SPECS` from `src/lib/hook-spec.ts` rather than an inline list.
- [ ] Existing tests that reference `UpgradeChange`, `collectUpgradeChanges`, or `--dry-run` are deleted or rewritten so the test suite matches the trimmed surface.
- [ ] A new Vitest integration test asserts that after `runUpgrade`: an edited `config.yaml` retains its edits byte-for-byte, and an edited prompt file under `.ai/knowledge-base/.config/prompts/` retains its edits byte-for-byte. A second `runUpgrade` is a no-op for both.
- [ ] `npm run build && npm test` pass with zero TypeScript errors and zero failing tests.
- [ ] `grep -rn "UpgradeChange\|collectUpgradeChanges\|EXPECTED_HOOK_COMMANDS\|dryRun" src tests` returns no results.

## Technical Requirements

- TypeScript edits in `src/commands/init.ts` and `src/cli.ts`.
- Vitest integration test, placed in `tests/init.test.ts` (or alongside existing init tests), using a temp-directory fixture.

## Input Dependencies

- Task 1: `src/lib/hook-spec.ts` must exist so `installClaude` can import `HOOK_SPECS`.

## Output Artifacts

- Trimmed `src/commands/init.ts` (substantially smaller than the current 614 lines).
- Trimmed `src/cli.ts` (no `--dry-run` flag on `init`).
- Updated `tests/init.test.ts` with the preservation test and minus the dead preflight tests.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Open `src/commands/init.ts` and delete in order:
   - `UpgradeChange` interface (lines ~128-143).
   - `collectUpgradeChanges` and its helpers (`inspectGitignore`, `hookRegistrationsNeedRefresh`, `filesEqual`, `skillDirsEqual`, `GitignoreState`, `EXPECTED_HOOK_COMMANDS`) around lines ~233-353.
   - Remove the `dryRun` field from the `InitOptions` interface.
   - Inside `runUpgrade`, delete the preflight invocation, the "Planned changes" log block, and the early-return when `dryRun` is true. The function should reduce to: validate the `installed-version` stamp exists, then run the existing apply phase verbatim.
2. Update `installClaude` and any other call site to iterate `HOOK_SPECS` from `src/lib/hook-spec.ts` instead of the inline array. Pass the same shape to `writeClaudeHookConfig` as before.
3. Open `src/cli.ts` and remove the `.option('--dry-run', ...)` line on the `init` subcommand. Remove any forwarding of `dryRun` to `runInit`/`runUpgrade`.
4. Audit `tests/`:
   - `grep -rn "UpgradeChange\|collectUpgradeChanges\|dryRun\|--dry-run" tests` and rewrite or delete each hit. Do not preserve tests for deleted behavior.
5. Add the preservation integration test:
   - Create a temp fixture directory.
   - Run `runInit({ ... })` to produce an initial install (including writing `config.yaml` and at least one prompt under `.ai/knowledge-base/.config/prompts/`).
   - Edit `config.yaml` (append a comment line) and edit one prompt file (append a marker line).
   - Capture the file contents.
   - Run `runUpgrade({ ... })`.
   - Assert both files are byte-identical to the captured edited contents.
   - Run `runUpgrade` again and re-assert.
   - Clean up the fixture in `afterEach`.
6. Run `npm run build && npm test`; fix any drift.
7. Run the stale-reference grep listed in the acceptance criteria and confirm it returns no hits.

</details>
