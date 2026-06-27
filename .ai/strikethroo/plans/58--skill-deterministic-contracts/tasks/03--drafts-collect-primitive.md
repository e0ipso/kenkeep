---
id: 3
group: "deterministic-primitives"
dependencies: [1]
status: "pending"
created: 2026-06-27
skills:
  - typescript-cli
  - vitest
complexity_score: 4
complexity_notes: "Aggregation + schema validation primitive; reuses Task 1's named-schema registry."
---
# Add `kk drafts collect` primitive (aggregate + schema-validate per-batch drafts)

## Objective
Replace the inline `node -e` concat-and-validate script and the per-batch
validation prose in `kk-curate` (parallel path) with a deterministic primitive.
`kk drafts collect --run-id <id> --schema <name>` reads
`.ai/kenkeep/_logs/curator/${RUN_ID}__*.draft.json`, validates each batch
against the named Zod schema (via Task 1's registry), concatenates the
survivors into one JSON array on stdout, and reports counts plus which batches
were invalid — never aborting on a single bad batch.

## Skills Required
TypeScript CLI command implementation (commander registration, filesystem glob,
zod validation) and Vitest test design.

## Acceptance Criteria
- [ ] `node dist/cli.js drafts collect --help` shows the command with `--run-id` and `--schema` options. (A `drafts` group with a `collect` subcommand.)
- [ ] It reads every `${RUN_ID}__*.draft.json` under `.ai/kenkeep/_logs/curator/`, parses each, and validates it against the schema resolved by name from Task 1's registry (the per-batch draft array validates as `curator-output`).
- [ ] Valid batches are concatenated, in deterministic batch order, into a single JSON array written to stdout. Invalid/unparseable batches are skipped (not fatal); the command still succeeds when at least the aggregation completes.
- [ ] A machine-readable report (to stderr or a `--report` channel) lists total batches, valid count, and the identifiers of invalid batches with the reason — matching the information the prose surfaced (`batch N produced invalid output, skipped`).
- [ ] Exit code reflects "aggregation completed" semantics: success even with some invalid batches; non-zero only on a usage error (missing run-id) or when no draft files exist for the run-id (so the skill can detect an empty run). Confirm the chosen semantics in the report and tests.
- [ ] Tests cover: all-valid aggregation preserving order and total count; a mixed run where one batch is malformed (skipped, reported, others survive); and an unknown `--schema` name erroring. Reuse Task 1's registry; do not duplicate name→schema resolution.
- [ ] `npm run build`, `npm run typecheck`, and the new tests pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- New: `src/commands/drafts-collect.ts` (and a `drafts` group registration in `src/cli.ts`).
- Import `resolveNamedSchema` (or equivalent) from Task 1's `src/lib/schema-registry.ts`; do NOT re-create the registry.
- Match the current concat contract in `kk-curate` Step 2 ("read its draft file and parse it as JSON; if parse fails or not an array or invalid `proposed_node` keys → skip and report; concatenate survivors"). See the `node -e` idiom and surrounding prose in `src/templates-source/skills/kk-curate/SKILL.md`.

## Input Dependencies
- Task 1 — the named-schema registry and `curator-output` name.

## Output Artifacts
The `kk drafts collect` command. Consumed by Task 6, which rewrites the
`kk-curate` parallel-path collector to call it instead of the inline `node -e`.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Read `src/templates-source/skills/kk-curate/SKILL.md` lines around "## 2. Read sessions in batches" → the draft-path convention `${RUN_ID}__${N}.draft.json` and the inline `node -e` concat block. Reproduce its exact survivor contract: parse JSON, require an array, validate each element's `proposed_node` keys via the schema; on any failure skip that batch and record it, never abort.
3. Resolve `--schema` through Task 1's registry. The default/expected name is `curator-output`. If the name is unknown, error with the available names (consistent with `kk schema`/`kk validate`).
4. Deterministic batch order: sort the draft filenames by the numeric batch index parsed from `${RUN_ID}__${N}.draft.json`, not lexicographically (so `__10` follows `__9`).
5. Keep stdout to the pure JSON array (so the skill can redirect it into `$PROPOSALS`); put the human/diagnostic report on stderr. Mirror how other primitives separate machine stdout from diagnostics.
6. Test philosophy — "write a few tests, mostly integration": fixture a temp `_logs/curator/` with several `RUN__N.draft.json` files (some valid `curator-output` arrays, one malformed), run the command, assert the stdout array length/order and the reported invalid batch. Test the aggregation/skip logic, not zod itself. One focused test file.
7. Run `npm run build`, `npm run typecheck`, and `npx vitest run` for the new test before declaring done. Report exactly which files changed.
</details>
