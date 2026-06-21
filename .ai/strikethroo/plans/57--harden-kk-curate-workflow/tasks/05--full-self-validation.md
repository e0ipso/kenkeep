---
id: 5
group: "validation"
dependencies: [1, 2, 3, 4]
status: "pending"
created: 2026-06-21
skills:
  - vitest
---
# Run the plan's full self-validation gate

## Objective
Execute the plan's Self Validation checklist end-to-end to confirm all six
primary success criteria hold together, and report any residual failure. This is
the integration/critical-path gate for plan 57.

## Skills Required
Vitest / Node CLI execution and reading test, typecheck, lint, and build output.

## Acceptance Criteria
- [ ] `npm run build` succeeds with no template-drift errors.
- [ ] `node dist/cli.js curate-persist --help` shows the command with the `--input` option.
- [ ] In a temp initialized fixture, a survivor JSON with one `add`, one `modify`, one `drop`, and one invalid `home_folder` run through `curate-persist` reports two writes, one drop, one failure, with files in the expected node folders.
- [ ] `npx vitest run tests/lib/rebalance.test.ts` confirms a parent folder with only child folders produces no merge action AND shared-tag root leaves produce one deterministic grouped `create-branch` action.
- [ ] `npm test`, `npm run typecheck`, and `npm run lint` all pass.
- [ ] A concise pass/fail report is produced mapping each of the plan's 6 primary success criteria to evidence.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Run the exact commands from the plan's "Self Validation" section (steps 1–6).
- If any check fails, document the precise failure; do not mask it.

## Input Dependencies
Tasks 1–4 (all implementation, docs, and template propagation complete).

## Output Artifacts
A validation report (pass/fail per success criterion) recorded for the execution
summary. No production code changes expected; if a check fails, surface it for
follow-up rather than silently patching.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Test philosophy — "write a few tests, mostly integration": this task RUNS the suite and the plan's self-validation; it does not add unit tests for trivial code. Add a test only if a self-validation step reveals a real uncovered gap in custom logic.
2. Execute, in order: `npm run build`; `node dist/cli.js curate-persist --help`; the temp-fixture curate-persist exercise; `npx vitest run tests/lib/rebalance.test.ts`; `npm test`; `npm run typecheck`; `npm run lint`.
3. Produce a table mapping plan success criteria 1–6 to pass/fail + evidence.
4. If anything fails, STOP and report it clearly with the failing output — do not edit production code to force a green result beyond legitimately completing tasks 1–4's scope.
</details>
