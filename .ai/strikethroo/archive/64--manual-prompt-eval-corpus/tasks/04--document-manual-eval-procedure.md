---
id: 4
group: "prompt-eval"
dependencies: [1, 2]
status: "completed"
created: 2026-07-19
skills:
  - technical-writing
complexity_score: 2
execution_profile: "docs-and-config"
---
# Document the manual eval procedure

## Objective

Write `docs/internals/prompt-eval.md` with the verbatim step-by-step manual
run procedure from issue #113, and add a cross-reference to it in
`docs/internals/manual-test-plan.md` for prompt-touching releases.

## Skills Required

- `technical-writing` — a procedure a maintainer can follow with exact
  commands, no reverse-engineering of intent.

## Acceptance Criteria

- [ ] `docs/internals/prompt-eval.md` documents the full manual procedure
      with verbatim commands: build, per-fixture hand-run of the extraction
      prompt into `tmp/prompt-eval-results/`, per-result
      `node dist/cli.js validate proposal-output <file>`, scorer invocation
      `node scripts/prompt-eval/score.mjs <fixtures-dir> <results-dir>`,
      pasting the score table into the Version-bump PR, and the optional
      `RESULTS.md` history.
- [ ] The doc records that model choice, temperature, and run count are the
      maintainer's call per run and must be noted alongside the score, and
      that the baseline v5 run is a post-merge manual maintainer step.
- [ ] The doc states the scoring is advisory only — exit 0 always, no gate —
      and that every LLM step is a human action (no launcher, hook, nudge,
      notification, harness exec by kenkeep code, or CI LLM run).
- [ ] Every documented deterministic command actually runs — verify: execute
      the documented scorer invocation against
      `tests/fixtures/prompt-eval` and an empty results directory; exit code
      is 0 and the output matches the doc's description of the
      "result file missing" report.
- [ ] `docs/internals/manual-test-plan.md` cross-references
      `prompt-eval.md` for prompt-touching releases — verify:
      `grep -c "prompt-eval" docs/internals/manual-test-plan.md` prints a
      number greater than 0.
- [ ] No other docs change: user-facing docs, AGENTS.md, and the docs site
      stay untouched (maintainer-internal tooling only).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Source the procedure text from issue #113 verbatim where the issue
  specifies commands; reconcile against the actual scorer CLI from task 1
  so documented commands and real behavior cannot disagree.
- Follow the existing tone and structure of `docs/internals/` documents.

## Input Dependencies

- Task 1: the scorer's actual invocation and report format (documented
  commands must be runnable against it).
- Task 2: the committed corpus (the documented fixtures path must exist for
  the verification step).

## Output Artifacts

- `docs/internals/prompt-eval.md` — the manual procedure.
- Updated `docs/internals/manual-test-plan.md` — release-time
  discoverability.

## Implementation Notes

<details>
<summary>Detailed guidance</summary>

- Fetch issue #113 for the procedure's verbatim command list; plan 64's
  "Documentation and Procedure" section enumerates what the doc must cover.
- The cross-reference in `manual-test-plan.md` should be a single scoped
  addition in the section covering prompt-touching releases — do not
  restructure the existing document.
- Keep corpus provenance out of this doc; that lives in
  `tests/fixtures/prompt-eval/README.md` (task 2). This doc covers only the
  run procedure.

</details>
