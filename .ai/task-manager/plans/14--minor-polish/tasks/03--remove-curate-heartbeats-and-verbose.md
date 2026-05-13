---
id: 3
group: "minor-polish"
dependencies: [2]
status: "pending"
created: 2026-05-13
skills:
  - typescript
---
# Remove `curate` heartbeats and `--verbose`; add `tail -f` startup hint

## Objective
Delete the per-batch `setInterval` heartbeat printer and the `--verbose` flag from the `curate` subcommand. Replace the noise with a single startup hint that points the user at the canonical log file via a copy-pasteable `tail -f` command.

## Skills Required
- `typescript`: edit `src/commands/curate.ts` and `src/cli.ts`; remove the hand-rolled `AssistantContentBlock` / `AssistantMessage` types and `makeVerbosePrinter` helper.

## Acceptance Criteria
- [ ] `rg -n 'HEARTBEAT_MS|heartbeats|makeVerbosePrinter|AssistantContentBlock|AssistantMessage' src/ tests/` returns zero hits.
- [ ] `CurateCommandOptions` no longer declares a `verbose?: boolean` field.
- [ ] `src/cli.ts` no longer defines `-v, --verbose` for the `curate` subcommand. `--verbose` on other subcommands (`doctor`, `lint`, etc.) is untouched.
- [ ] `runCurateCommand` prints exactly two lines under the run header: `  curator log: <path>` followed immediately by `  follow live: tail -f <path>` (both via `log.plain`).
- [ ] Batch lines `Batch X/Y: ...` (start) and `Batch X finished in Zs` (end) still print on every batch.
- [ ] `onBatchStart` and `onBatchEnd` no longer manipulate any `setInterval` / `clearInterval` timers.
- [ ] No `still running (Xs)…` string remains anywhere in `src/`.
- [ ] `ai-knowledge-base curate --help` does not list `--verbose` / `-v`.
- [ ] No tests assert on heartbeat output or `--verbose` behaviour for `curate`. Any such test is deleted; other tests still pass.
- [ ] `npm run lint && npm run typecheck && npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The verbose printer subscribed to the curator subprocess's stream-json messages using a hand-rolled type (`AssistantContentBlock`); removing it also removes one untyped coupling to the assistant's wire format.
- If `isObject` is defined inside `src/commands/curate.ts` and no other code in the file uses it after this change, delete it. If it has other consumers, leave it.
- The two new `log.plain` lines mirror the formatting of the existing `  curator log: ...` line. Use the same indentation and the same `log.plain` API.
- Locations called out in the plan:
  - `src/commands/curate.ts:22,101` — `verbose?` on `CurateCommandOptions`, conditional wiring of `onCuratorMessage`.
  - `src/cli.ts:97-117` — `.option('-v, --verbose', ...)` chain and the `if (opts.verbose === true) curateOpts.verbose = true;` line.
- `HEARTBEAT_MS`, the `heartbeats: Map<...>` declaration, the per-batch `setInterval` block, and the `finally` cleanup loop are inside `runCurateCommand`; delete the lot.

## Input Dependencies
- Task 2 must be merged first (it edits `src/lib/curate.ts` for the lock; this task edits `src/commands/curate.ts`, but the test infrastructure changes from task 2 should land first to keep `npm test` green throughout).

## Output Artifacts
- Edited `src/commands/curate.ts` (smaller; no heartbeat or verbose plumbing; extra `tail -f` hint line).
- Edited `src/cli.ts` (no `--verbose` on `curate`).
- Possibly deleted tests under `tests/` that asserted on heartbeat or verbose output (none expected, per the plan; verify before deleting).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `src/commands/curate.ts` end-to-end before editing. Identify:
   - The `HEARTBEAT_MS` constant.
   - The `heartbeats: Map<number, { timer: NodeJS.Timeout; started: number }>` (or similar shape) declaration.
   - The `onBatchStart` block that calls `setInterval(...)` and stores the timer in `heartbeats`.
   - The `onBatchEnd` block that calls `clearInterval(...)` and clears the entry.
   - The `finally { ... }` block that loops over remaining heartbeats and clears them.
   - The `verbose?: boolean` field on `CurateCommandOptions`.
   - The `makeVerbosePrinter` helper and its `AssistantContentBlock`/`AssistantMessage` interfaces.
   - The `if (options.verbose === true) ctx.onCuratorMessage = makeVerbosePrinter(...);` (or equivalent) wiring.
2. Delete every item above. Leave `onBatchStart` printing just the batch-summary `log.info` line; leave `onBatchEnd` printing just the `log.success(\`Batch ${index + 1} finished in ${Math.round(durationMs / 1000)}s\`)` line.
3. Right after the existing `log.plain(\`  curator log: ${logFile}\`)` call, add:
   ```ts
   log.plain(`  follow live: tail -f ${logFile}`);
   ```
4. Edit `src/cli.ts`:
   - Remove the `.option('-v, --verbose', ...)` line from the `curate` subcommand builder only.
   - Remove the `if (opts.verbose === true) curateOpts.verbose = true;` line.
   - Confirm `--verbose` on `doctor`, `lint`, and any other subcommand is untouched.
5. Run `npx tsc --noEmit`. Fix any callers that read `options.verbose` for curate.
6. Run `npm test`. If any test references the heartbeat or verbose behaviour, delete that test (or test block). Verify no other test asserts on the new `follow live:` line; if one does, update it.
7. Run `ai-knowledge-base curate --help` (via `node dist/cli.js` after `npm run build`, or via the test harness) and confirm `--verbose` / `-v` is absent.
8. Final sweep: `rg -n 'HEARTBEAT_MS|heartbeats|makeVerbosePrinter|AssistantContentBlock|AssistantMessage|still running' src/ tests/` — expect zero hits.

</details>
