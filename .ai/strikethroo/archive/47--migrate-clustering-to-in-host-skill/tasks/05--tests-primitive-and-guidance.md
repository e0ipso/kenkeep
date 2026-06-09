---
id: 5
group: "tests"
dependencies: [1, 3, 4]
status: "completed"
created: 2026-06-09
skills:
  - vitest
---
# Test the placement primitive, the removed command, and the repointed guidance

## Objective
Rework and extend the test suite to cover the new architecture: feed
placement-and-folders JSON directly to the deterministic primitive's apply mode
(no cluster stub), assert the orphan/unknown-id abort makes zero filesystem
changes, exercise the inventory mode's detect/emit/"nothing to do" branches,
confirm `npx kenkeep migrate` is now an unknown command, and assert that the
repointed guidance (reader error, init hint) and the `kk-migrate` skill
materialization (init + upgrade) are in place.

## Skills Required
- `vitest`: writing and refactoring Vitest suites that drive the CLI and library
  primitives against a sandbox knowledge base.

## Acceptance Criteria
- [ ] `tests/commands/migrate.test.ts` is reworked (or replaced by a
      primitive-named test) so the v1->v2 placement is exercised by feeding the
      placement-and-folders JSON to the apply mode directly, rather than
      injecting a `cluster` stub into a now-deleted `runMigrate`.
- [ ] A test asserts the **apply mode preserves guarantees**: every node id and
      all edges survive, leaves move as renames (ids and bytes preserved), each
      created folder's `index.md` carries its authored summary, and no git
      command is invoked (working tree left dirty).
- [ ] A test asserts the **abort-before-write guarantee**: an apply input with a
      folder summary keyed to a folder no leaf is placed into (orphan) AND/OR a
      placement with an unknown/omitted id exits non-zero and produces **zero**
      filesystem changes.
- [ ] A test asserts **inventory mode**: against a v1 KB it emits the flat leaves
      as JSON and identifies the KB as migration-eligible; against a current v2
      KB it reports "nothing to do" and exits 0.
- [ ] A test asserts `migrate` is no longer a command (invoking the built CLI
      with `migrate` exits non-zero / unknown command).
- [ ] `tests/init.test.ts` (and `tests/upgrade.test.ts` if it covers skills) is
      updated: the assertion on the old migrate hint now asserts the
      **skill-based** guidance, and a test asserts `kk-migrate/SKILL.md` is
      materialized into the harness skills directory on `init` and refreshed on
      `upgrade`, alongside `kk-curate`.
- [ ] A test (or assertion) covers the repointed `OldLayoutError` message naming
      the `kk-migrate` skill rather than the removed command.
- [ ] `npx vitest run` passes; `tsc --noEmit`, `eslint .`, and `prettier
      --check .` pass for the test files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Build on the existing sandbox helpers used by `tests/commands/migrate.test.ts`
  (`makeSandbox`, `cleanSandbox`, `cliPath` from `tests/helpers.js`) and its
  `writeFlatLeaf` helper that writes `schema_version: 1` leaves at
  `nodes/<kind>/<id>.md`.
- Drive the primitive either via its exported run-functions (import from the new
  command module) for unit-level assertions, or via the built CLI (`execFile`
  with `cliPath`) for the end-to-end stdin->apply path; prefer the direct
  function/CLI path that mirrors how `tests/commands/rebalance.test.ts` tests the
  rebalance primitive.
- Reuse `writePlacements` / `TargetExistsError` import sites already present in
  the current migrate test where still relevant; drop imports of the deleted
  `runMigrate` and the `ClusterFn` stub typing.
- For the "no filesystem changes on abort" assertion, snapshot the `nodes/` tree
  (e.g. a recursive listing + per-file hash, or the existing `collectLeaves`
  helper) before and after the failing apply call and assert equality.
- For init/upgrade: assert the destination skills directory contains
  `kk-migrate/SKILL.md` after `runInit` (and after an upgrade run), mirroring any
  existing assertion for `kk-curate`.

## Input Dependencies
- Task 1: the primitive's exported run-functions, command names, and the
  placement-and-folders JSON contract under test.
- Task 3: the `migrate` command removal (so the "unknown command" assertion is
  true).
- Task 4: the repointed guidance strings (so the reader-message and init-hint
  assertions target the new wording).

## Output Artifacts
- A green, reworked test suite covering Primary Success Criteria 3 (end-to-end
  guarantees), 4 (deterministic apply + orphan rejection with no writes), 5
  (skill materialized on init/upgrade), and the command-removal portion of 2.

## Implementation Notes
Apply the project's test philosophy: **write a few tests, mostly integration.**
Meaningful tests verify custom business logic, critical paths, and edge cases
specific to this application — test *your* code, not the framework or library.

Write tests for: the deterministic placement business logic (reconcile +
place + stamp), the critical abort-before-write edge case, the inventory
detect/emit branches, and the integration points (CLI dispatch no longer has
migrate; init/upgrade materializes the skill). Do NOT write per-method unit
tests for trivial wrappers, framework behavior, or simple config. Combine
related scenarios into single tests (e.g. one "apply preserves ids/edges/bytes
and stamps summaries" test rather than separate tests per field). Favor
integration and critical-path coverage over exhaustive per-case units. Question
whether a simple assertion needs its own dedicated test.

<details>
<summary>Detailed implementation guidance</summary>

**Start from the current suite.** Read `tests/commands/migrate.test.ts` in full
(429 lines). It already builds a v1 sandbox, injects a deterministic `cluster`
stub into `runMigrate`, and asserts placement/edges/summaries. Salvage the
sandbox setup (`writeFlatLeaf`, `collectLeaves`, the edge-preservation
assertions) and re-aim them at the primitive:
- Replace `runMigrate({ cluster: stub, harness })` calls with: build the
  placement-and-folders JSON the stub used to return, then call the apply mode
  (export it from the new command module, or pipe it through the built CLI's
  apply subcommand via `execFile`).
- Keep the assertions that every id/edge survived and that each created folder's
  `index.md` has the authored summary. Add a byte-stability assertion if not
  already present (read a leaf's body before/after; it must be identical modulo
  the `schema_version` bump).

**Abort-before-write test.** Construct an apply input that is deliberately bad in
the two ways the guards catch:
- an unknown/omitted leaf id (reconcilePlacements throws), and/or
- a folder summary keyed to a folder no placement creates
  (reconcileFolderSummaries throws).
Snapshot `nodes/` (recursive file list + contents/hashes), run apply, assert it
exits non-zero AND the snapshot is byte-identical afterward (zero writes). This
is the regression guard for the plan's "Loss of the abort-before-write
guarantee" risk.

**Inventory test.** Against the v1 sandbox: run inventory mode, assert stdout is
parseable JSON containing the flat leaves (ids present) and that the KB is
flagged migration-eligible. Build a minimal current (v2) KB and assert inventory
reports "nothing to do" and exits 0. (Detection logic itself lives in
`detectSchemaVersion`, already tested elsewhere — here assert the primitive's
*mode wiring*, not re-test the detector exhaustively.)

**Command-removal test.** `execFile(process.execPath, [cliPath, 'migrate'])`
should reject / exit non-zero with an unknown-command error. Assert on exit code
(and optionally stderr mentioning unknown command). This complements Task 3.

**Guidance + materialization (init/upgrade).** In `tests/init.test.ts`: find the
existing assertion on the migrate hint (it asserts the old
`npx kenkeep --harness <id> migrate` text) and change it to assert the new
skill-based guidance string. Add/extend an assertion that, after `runInit`, the
harness skills directory contains `kk-migrate/SKILL.md` (locate how the test
asserts `kk-curate` is copied and mirror it). If `tests/upgrade.test.ts` asserts
skill refresh, add `kk-migrate` there too. Also assert the `OldLayoutError`
message (constructed against a v1 sandbox, or asserted as a string) names the
`kk-migrate` skill.

**Hygiene.** Remove now-dead imports (`runMigrate`, the `ClusterFn`/`ClusterResult`
types if the test imported them). Run `npx vitest run` and iterate until green;
then `tsc --noEmit`, `eslint .`, `prettier --check .`.
</details>
