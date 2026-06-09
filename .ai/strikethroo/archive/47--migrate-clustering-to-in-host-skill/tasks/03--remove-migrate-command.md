---
id: 3
group: "removal"
dependencies: [1]
status: "completed"
created: 2026-06-09
skills:
  - typescript-node-cli
---
# Remove the migrate command and its nested `-p` clustering spawn

## Objective
Delete the hidden `migrate` command and every part of its LLM/`-p` path so no
code path can spawn a nested harness for clustering. Remove the `migrate`
command registration in `src/cli.ts`, `runMigrate`, `makeHarnessCluster`, the
`CLUSTER_INSTRUCTIONS` constant, the `PlacementResponseSchema`/`parsePlacements`
harness-output parsing, and the LLM portion of `flatToTreeStep`. The
deterministic helpers (`reconcilePlacements`, `reconcileFolderSummaries`) have
already been relocated by Task 1 and must not be lost; this task removes the now
duplicate definitions in `migrate.ts` and any remaining references. After this
task, `npx kenkeep migrate` no longer resolves to a command.

## Skills Required
- `typescript-node-cli`: TypeScript/Node refactoring and dead-code removal
  across the CLI dispatcher and command modules, keeping the build green.

## Acceptance Criteria
- [ ] The `program.command('migrate', { hidden: true })` registration block in
      `src/cli.ts` is removed, along with the `runMigrate` import.
- [ ] `runMigrate`, `makeHarnessCluster`, `CLUSTER_INSTRUCTIONS`,
      `PlacementResponseSchema`, and `parsePlacements` no longer exist anywhere
      in `src/`.
- [ ] No `execFileSync(..., ['-p', ...])` clustering spawn remains; grep for
      `'-p'`, `CLUSTER_INSTRUCTIONS`, and `makeHarnessCluster` over `src/` returns
      nothing.
- [ ] `reconcilePlacements` and `reconcileFolderSummaries` survive in their
      Task 1 home (the lib module) and are no longer duplicated in
      `src/commands/migrate.ts`; if `src/commands/migrate.ts` no longer has any
      remaining responsibility, it is deleted outright.
- [ ] The version-chain machinery (`detectSchemaVersion`, `planMigration`,
      `MigrationStep` in `src/lib/migrate.ts`) is retained — it is now consumed
      by the deterministic primitive (Task 1), not deleted.
- [ ] `tsc --noEmit`, `eslint .`, and `prettier --check .` pass; no unused
      imports or dead exports remain (eslint will flag them).
- [ ] Running the built CLI with `migrate` exits as an unknown command.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Edit `src/cli.ts`: remove the migrate `import { runMigrate }` line and the
  entire `program.command('migrate', { hidden: true })…` block (currently lines
  ~170-188, including its `addHelpText`).
- Edit/delete `src/commands/migrate.ts`: remove `runMigrate`, `buildSteps`,
  `flatToTreeStep` (or reduce it if any deterministic remnant is still needed —
  but the primitive now owns placement, so the step's LLM body goes),
  `makeHarnessCluster`, `CLUSTER_INSTRUCTIONS`, `PlacementResponseSchema`,
  `parsePlacements`, and the `ClusterResult`/`ClusterFn`/`MigrateOptions`
  interfaces if nothing else uses them. Remove the now-duplicate
  `reconcilePlacements`/`reconcileFolderSummaries` (Task 1 relocated them).
- Drop the now-unused imports in `migrate.ts`: `execFileSync`, `z`,
  `resolveActiveHarness`, `listHarnessIds`, `extractJsonPayload`,
  `resolveSettings`, and any others left dangling.
- Do NOT touch `src/lib/migrate.ts` (version chain), `src/lib/migrate-read.ts`,
  `src/lib/migrate-flat-to-tree.ts`, or `stampFolderSummary` — those are reused.

## Input Dependencies
- Task 1 must have relocated `reconcilePlacements` and `reconcileFolderSummaries`
  into a lib module and stood up the deterministic primitive that consumes the
  version chain. Removing the command before relocation would orphan those
  guards; hence the hard dependency on Task 1.

## Output Artifacts
- A `src/cli.ts` with no `migrate` subcommand.
- Deletion (or minimization) of `src/commands/migrate.ts` with all LLM/`-p` code
  gone. This satisfies Primary Success Criterion 1 (no nested-harness spawn) and
  the first half of Criterion 2 (`migrate` no longer resolves).

## Implementation Notes
This is a deletion task; the substance was moved by Task 1. The risk is leaving
a dangling import or a half-deleted function that breaks `tsc`/`eslint`. Work
top-down: remove the CLI registration first, then the command internals, then
let `tsc --noEmit` and `eslint .` point at every orphaned reference.

<details>
<summary>Detailed implementation guidance</summary>

**Step 1 — `src/cli.ts`.** Delete the import `import { runMigrate } from
'./commands/migrate.js';` (line 11) and the entire migrate command block
(lines ~170-188): the leading comment, `program.command('migrate', { hidden:
true })`, `.description(...)`, `.addHelpText('after', …)`, and the `.action(...)`
that calls `runMigrate`. Leave the surrounding `bootstrap-incremental` block
(above) and `rebalanceGroup` block (below) intact.

**Step 2 — `src/commands/migrate.ts`.** After Task 1, the deterministic guards
live elsewhere. Decide the file's fate:
- If Task 1 moved `reconcilePlacements`/`reconcileFolderSummaries` into a new
  module and the new primitive imports them there, then `migrate.ts` has nothing
  left worth keeping once `runMigrate`/`flatToTreeStep`/`makeHarnessCluster`/
  `CLUSTER_INSTRUCTIONS`/`parsePlacements`/`PlacementResponseSchema` are removed
  — delete the file entirely (`git rm`).
- If for any reason Task 1 left the guards in `migrate.ts` and re-exported them,
  invert that now: ensure the canonical home is the lib module, update importers,
  and delete `migrate.ts`. Do not keep two copies.

**Step 3 — chase the compiler.** Run `npx tsc --noEmit`. Every error points at a
now-missing symbol or an unused import. Remove unused imports in any file that
referenced the deleted command. Run `npx eslint .` to catch unused vars/exports
ESLint's `no-unused-vars` flags (the project lints this).

**Step 4 — verify the command is gone.**
```
grep -rn "CLUSTER_INSTRUCTIONS\|makeHarnessCluster\|runMigrate" src/   # -> empty
grep -rn "'-p'" src/                                                    # -> no clustering spawn
```
(Note: other launchers, e.g. curate/bootstrap/node-add, legitimately use `-p`
via `src/lib/launch-skill.ts`; those are explicitly OUT of scope — do not touch
them. The grep target is only the clustering spawn inside the old migrate path.)

**Step 5 — build sanity.** `npm run build` then invoke the built CLI's `migrate`
subcommand; commander should report it as unknown (non-zero). Tests for this
land in Task 5; here just confirm the build is green and the command is absent.

Do not modify `src/lib/migrate.ts`, `src/lib/migrate-read.ts`, or
`src/lib/migrate-flat-to-tree.ts` beyond what Task 1 already changed — the
version chain and the read/write primitives are retained and reused.
</details>
