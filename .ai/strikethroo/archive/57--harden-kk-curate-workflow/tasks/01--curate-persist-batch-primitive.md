---
id: 1
group: "curate-cli"
dependencies: []
status: "completed"
created: 2026-06-21
skills:
  - typescript-cli
  - vitest
---
# Verify and complete the `curate-persist` batch survivor primitive

## Objective
Ensure `kenkeep curate-persist --input <path>` deterministically persists a
batch of curator survivor actions in one pass, with all-or-nothing validation
of malformed input and per-action partial-failure reporting. Commit `e14fe72`
already added `src/commands/curate-persist.ts`, CLI registration in
`src/cli.ts`, and `tests/commands/curate-persist.test.ts`; this task verifies
that work against the plan's success criteria and fills any gap.

## Skills Required
TypeScript CLI command implementation (commander registration, zod schema
validation, filesystem/path safety) and Vitest test design.

## Acceptance Criteria
- [ ] `node dist/cli.js curate-persist --help` shows the command with an `--input` option.
- [ ] Valid survivor JSON (array of curator actions from `curate-dedup`) is validated against the curator action schema before any write; malformed input writes nothing and exits non-zero.
- [ ] `add` actions write to their `home_folder` (resolved safely under `nodes/`) or the root fallback; `modify` actions resolve `target_node_id` and write in place; `drop` is skipped; `contradict` is rejected (conflicts belong to `curate-dedup`).
- [ ] `home_folder` is path-safety checked: absolute paths and `..` traversal are rejected; destination folder must exist.
- [ ] stdout is a single JSON summary with counts and per-action results (status, id/path/placement for writes, failure reason on error).
- [ ] Exit code is non-zero only for malformed input or when at least one valid action failed; successful partial writes are preserved.
- [ ] Existing node id, schema validation, path safety, and write helpers are reused (no duplicated markdown serialization).
- [ ] Tests cover: happy-path batch, malformed-input all-or-nothing rejection, `drop` skip, `contradict` rejection, unsafe `home_folder` rejection, and partial-failure exit code.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Command file: `src/commands/curate-persist.ts`; registration in `src/cli.ts`.
- Reuse `src/commands/node-write.ts` / `src/lib/nodes.ts` write + validation helpers and existing path-safety utilities (the same ones used elsewhere under `nodes/`).
- Survivor schema matches the JSON emitted by `curate-dedup` (see `src/commands/curate-dedup.ts`).
- Tests in `tests/commands/curate-persist.test.ts` using Vitest and a temporary initialized kenkeep fixture.

## Input Dependencies
None. Builds on already-committed `e14fe72`.

## Output Artifacts
A verified/complete `curate-persist` command and its test file. Consumed by the
docs/template task (04) and the final validation task (05).

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Run `git show e14fe72 -- src/commands/curate-persist.ts src/cli.ts tests/commands/curate-persist.test.ts` to see what already exists. Do NOT rewrite working code; only fill gaps against the acceptance criteria.
2. Build and exercise the command end-to-end per plan self-validation step 3: in a temp fixture create a survivor JSON with one `add`, one `modify`, one `drop`, and one invalid `home_folder`; run `node dist/cli.js curate-persist --input <file>` and confirm stdout reports two writes, one drop, one failure, with the written files in the expected node folders and a non-zero exit (one valid action failed).
3. Test philosophy — "write a few tests, mostly integration": test custom logic (validation, placement, partial-failure accounting, path safety), not commander/zod themselves. Combine related scenarios into the single test file rather than one test per action type.
4. Confirm `home_folder` resolution rejects absolute paths and `..`, and requires the destination folder to exist before writing.
5. Run `npm run build` and the focused test (`npx vitest run tests/commands/curate-persist.test.ts`) before declaring done. Report exactly which files you changed.
</details>
