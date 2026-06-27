---
id: 8
group: "validation"
dependencies: [1, 2, 3, 4, 5, 6, 7]
status: "pending"
created: 2026-06-27
skills:
  - shell-scripting
complexity_score: 4
complexity_notes: "Runs the plan's full Self Validation gate end-to-end and confirms the success criteria against live evidence."
---
# Run the plan's full Self Validation gate

## Objective
Execute every step of the plan's "Self Validation" section against the live tree
and confirm all Primary Success Criteria hold, producing concrete evidence
(commands + outputs) rather than claims. This is the terminal verification gate
for plan 58.

## Skills Required
Shell scripting and reading/running the project's verification commands (`wc`,
`rg`, `diff`/`cmp`, `npm` scripts).

## Acceptance Criteria
- [ ] `wc -l` on every scoped `kk-*/SKILL.md` shows a material reduction versus the pre-edit counts recorded in Task 6.
- [ ] A read-through of each rewritten skill against the Task 6 baseline checklist confirms every CLI primitive, flag, action type, `home_folder`, field name, output schema, and conflict token/outcome is still available (directly or via the referenced primitive).
- [ ] `kk schema <name>` and `kk validate <name>` are exercised on a valid AND an invalid artifact: the JSON Schema matches the Zod shape and validation errors are line/path-referenced. Capture the commands and outputs.
- [ ] The new primitive tests pass: `conflict prepare` default computation, `drafts collect` aggregation/validation, and the init/upgrade test covering `ensureKkScripts` delivery of `kk-detect-root.mjs`.
- [ ] `npm run build:templates` produces a `templates/` diff that mirrors source with no hand edits.
- [ ] `npm run lint:detect-harness`, then `npm run lint`, `npm run typecheck`, and `npm test` all pass. Record the test pass count.
- [ ] `rg 'reference runtime'` over `src/templates-source` and installed skill trees returns nothing in scope.
- [ ] `rg 'kk-detect-root|resolve-root|kk schema|kk validate|conflict prepare|drafts collect|curate-persist'` over the skills confirms every expected reference resolves.
- [ ] `diff -u`/`cmp` of canonical kk skills vs generated `templates/skills/kk-*` vs installed copies (including the new shared appendix and `batch-agent-prompt.md`) shows no unexpected divergence.
- [ ] The Task 5 contingent outcome (index-rebuild self-detect implemented vs deferred) is confirmed consistent with the skills' harness-resolution state.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Run from the repo root. Use the exact commands enumerated in the plan's Self Validation section (steps 1–9).
- Do not modify source to make a check pass; if a check fails, report it as a blocking finding for the orchestrator (do not paper over it).

## Input Dependencies
- All implementation tasks (1–7).

## Output Artifacts
A validation report (commands, outputs, exit codes, test counts) confirming the
plan's Success Criteria, suitable for the plan's execution summary.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Work through Self Validation steps 1–9 from `plan-58--skill-deterministic-contracts.md` in order. For each, run the command, read the output and exit code, and state the result — never "probably passes".
3. For step 3, build first (`npm run build`), then in a temp initialized kenkeep fixture run `kk schema node`/`kk schema curator-output` and `kk validate node <good>` / `kk validate node <bad>`; capture both outcomes.
4. For step 6, run `npm run lint:detect-harness` first (the plan calls it out because root-detection extraction must not affect the harness drift lint), then the full `lint`, `typecheck`, `test`.
5. If ANY step fails, stop and report the failure with its output to the orchestrator; do not edit source here — fixes belong to the owning task. This task's job is to prove state, not to change it.
6. Summarize pass/fail per criterion with evidence. Report the final `npm test` count and the per-skill `wc -l` before/after.
</details>
