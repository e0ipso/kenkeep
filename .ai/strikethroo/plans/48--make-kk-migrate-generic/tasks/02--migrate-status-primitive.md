---
id: 2
group: "dispatch-core"
dependencies: [1]
status: "completed"
created: 2026-06-09
skills:
  - typescript-node-cli
  - vitest
complexity_score: 5
complexity_notes: "New command group with a strict machine-readable stdout contract (exactly one JSON line, no prefix/color) plus three fixture states to cover; the group must not be confused with the removed in-CLI migrate command."
---
# Implement the migrate status dispatch primitive and its JSON contract

## Objective
Add a deterministic, LLM-free `migrate status` CLI command that answers "what migrations are pending?": it detects the on-disk schema version with `detectSchemaVersion`, resolves the ordered pending chain with `planMigration` over the step registry, and prints either a one-line "nothing to do" report or exactly one machine-readable JSON line for the `/kk-migrate` skill to dispatch on.

## Skills Required
- `typescript-node-cli` — new command module plus commander wiring in `src/cli.ts`, following the existing `place`/`rebalance` patterns.
- `vitest` — sandboxed CLI tests asserting the stdout contract across fixture states.

## Acceptance Criteria
- [ ] New `migrate` command group with a single `status` subcommand wired in `src/cli.ts`; the command handler lives in a new `src/commands/migrate.ts` (e.g. `runMigrateStatus(): Promise<number>`).
- [ ] With no knowledge base: prints `No knowledge base found under nodes/; nothing to do.` and exits 0. With a current KB (version >= `NODE_SCHEMA_VERSION`): prints `Knowledge base is already at schema_version N; nothing to do.` and exits 0. Both mirror `place inventory`'s existing short-circuit wording.
- [ ] With pending steps: stdout is exactly one parseable JSON line (written via `process.stdout.write`, never `log`) carrying the detected version and the ordered chain, each entry with the step's `id`, `from`, `to`, and `primitives`. Nothing else is written to stdout.
- [ ] An unbridgeable gap (no registered step from the detected version) fails loudly: `planMigration`'s error is surfaced via `log.error` and the command exits non-zero.
- [ ] The group and subcommand descriptions state explicitly that the CLI only *reports* pending migrations and never executes them — migrations run in-host via the `kk-migrate` skill. A bare `kenkeep migrate` surfaces the group help (it must not error silently or do work).
- [ ] New tests in `tests/commands/migrate-status.test.ts` cover: v1 flat fixture → exit 0 and stdout is exactly one JSON line whose chain is the single `flat-to-tree` step (from 1, to 2); current v2 fixture → the "nothing to do" line and exit 0; no KB → the "nothing to do" line and exit 0. The v1 case asserts stdout contract purity (one line, `JSON.parse` succeeds on it).
- [ ] Full test suite, build, and lint pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse `detectSchemaVersion`, `planMigration`, and the registry constant from `src/lib/migrate.ts` (task 1's shape); `NODE_SCHEMA_VERSION` from `src/lib/schemas.js`; `repoPaths(findRepoRoot())` from `src/lib/paths.js`; `log` from `src/lib/log.js`.
- Follow the machine-readable contract convention established by `runPlaceInventory` (src/commands/place.ts:27–46) and `rebalance trigger`: the JSON payload goes through `process.stdout.write` with a trailing `\n`; human-facing report lines go through `log.plain`.
- Tests use the existing helpers in `tests/helpers.ts` (`makeSandbox`, `cleanSandbox`, `runCli`).

## Input Dependencies
- Task 1: the reshaped `MigrationStep` interface and the exported registry constant — `migrate status` is their first real consumer.

## Output Artifacts
- `src/commands/migrate.ts` and the `migrate` group wiring in `src/cli.ts`.
- The stable `migrate status` JSON contract that task 4's SKILL.md dispatch step documents, and the command tasks 3 and 5 point refusal messages and help text at.
- `tests/commands/migrate-status.test.ts`.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

Handler logic, in order:

1. `const paths = repoPaths(findRepoRoot());`
2. `const current = detectSchemaVersion(paths.nodesDir);`
3. `current === null` → `log.plain('No knowledge base found under nodes/; nothing to do.'); return 0;`
4. `current >= NODE_SCHEMA_VERSION` → `log.plain(`Knowledge base is already at schema_version ${current}; nothing to do.`); return 0;`
5. Otherwise resolve the chain inside try/catch: `planMigration(MIGRATION_STEPS, current, NODE_SCHEMA_VERSION)`. On throw: `log.error(...)` with the error message and `return 1` (the gap case).
6. Emit exactly one JSON line, e.g. `{"current":1,"target":2,"steps":[{"id":"flat-to-tree","from":1,"to":2,"primitives":["place inventory","place apply"]}]}` via `process.stdout.write(`${JSON.stringify(payload)}\n`); return 0;`. Field names may vary slightly but must include the detected version and, per step, `id`/`from`/`to`/`primitives` — the plan requires the detected version to be reported alongside the chain so mixed-version trees are visible.

CLI wiring (src/cli.ts, next to the existing `place` group around line 170):

- Group description along the lines of: "Reports pending knowledge-base migrations. Never executes them: migrations run in-host via the kk-migrate skill, which dispatches on this command's output." Reintroducing the `migrate` name is intentional — the removed `migrate` command *executed* migrations; this one only reports. The descriptions carry that distinction.
- `status` description should name the JSON shape, mirroring how `place inventory`'s description does.
- Bare `kenkeep migrate` showing group help is commander's default for a group invoked without a subcommand when no group-level action is registered; verify rather than assume (a test or manual check is fine).

Tests: create a v1 fixture by writing leaves at `nodes/practice/<id>.md` with `schema_version: 1` frontmatter and no `index.md` (see the `writeFlatLeaf` helper inside `tests/commands/place.test.ts` for the exact frontmatter fields — replicate locally, do not import across test files unless the suite already shares such helpers). The v2 fixture can be a nested tree whose leaves carry `schema_version: 2`.

Test philosophy (apply when writing the tests): a few meaningful tests, mostly integration. The custom logic here is the dispatch contract — the three fixture states and the one-JSON-line stdout purity (a documented risk: any prefix or color corrupts the skill's parse). Do not test commander itself, and do not add per-field unit tests; one assertion set per fixture state is enough.

</details>
