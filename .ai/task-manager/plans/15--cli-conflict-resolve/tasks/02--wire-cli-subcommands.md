---
id: 2
group: "cli-commands"
dependencies: [1]
status: "pending"
created: 2026-05-13
skills:
  - typescript
---

# Wire `conflict list` and `conflict resolve` subcommands into `src/cli.ts`

## Objective

Expose the new `runConflictList` / `runConflictResolve` entry points through commander so that `ai-knowledge-base conflict list` and `ai-knowledge-base conflict resolve <id> --action <replace|reject>` work from the CLI.

## Skills Required

- `typescript`: extend the existing commander wiring following the `node` / `index` / `logs` group patterns already in `src/cli.ts`.

## Acceptance Criteria

- [ ] `src/cli.ts` defines a new `conflict` subcommand group via `program.command('conflict').description('Resolve conflicts surfaced by the curator.')`.
- [ ] `conflict list` is registered with no options; its action calls `runConflictList()` and `process.exit`s with the returned code.
- [ ] `conflict resolve <conflictId>` requires `--action <replace|reject>` and rejects any other value with a usage error before any state is touched (use commander's `choices` or equivalent inline validation). Its action calls `runConflictResolve({ conflictId, action })` and `process.exit`s with the returned code.
- [ ] `ai-knowledge-base --help` lists the new `conflict` group; `ai-knowledge-base conflict --help` lists both subcommands.
- [ ] `tsc --noEmit` passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Mirror the structure of the existing `nodeGroup` / `indexGroup` / `logsGroup` blocks in `src/cli.ts` (lines 175–199 for the closest pattern).
- Import the new functions: `import { runConflictList, runConflictResolve } from './commands/conflict.js';`.

## Input Dependencies

- Task 1 (`src/commands/conflict.ts` must export `runConflictList` and `runConflictResolve`).

## Output Artifacts

- Updated `src/cli.ts` with the `conflict` group wired in.

## Implementation Notes

<details>
<summary>Wiring sketch</summary>

Insert immediately after the `indexGroup` block (around line 199) so the ordering matches related commands:

```ts
const conflictGroup = program
  .command('conflict')
  .description('Resolve conflicts surfaced by the curator.');
conflictGroup
  .command('list')
  .description('Print pending conflicts from .ai/knowledge-base/.state/pending-conflicts.json as JSON.')
  .action(async () => {
    const code = await runConflictList();
    process.exit(code);
  });
conflictGroup
  .command('resolve <conflictId>')
  .description('Apply the user decision for a single conflict: replace the existing node or reject the proposal.')
  .requiredOption('--action <action>', 'replace | reject')
  .action(async (conflictId: string, opts: { action: string }) => {
    if (opts.action !== 'replace' && opts.action !== 'reject') {
      log.error(`--action must be 'replace' or 'reject' (got '${opts.action}')`);
      process.exit(1);
    }
    const code = await runConflictResolve({ conflictId, action: opts.action });
    process.exit(code);
  });
```

If commander's `.choices()` is preferred (it is in scope in this project's commander version), use it on the option; otherwise the inline check above is acceptable. Whichever you pick, the validation must run before the action body so unknown actions never reach `runConflictResolve`.

`log` is already imported at the top of `src/cli.ts`; no new imports beyond `runConflictList` / `runConflictResolve` are needed.

</details>
