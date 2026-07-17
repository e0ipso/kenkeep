---
id: 4
group: "retrieval-eval-validation"
dependencies: [3]
status: "pending"
created: 2026-07-17
skills:
  - mutation-testing
complexity_score: 3
execution_profile: "standard-implementation"
---
# Verify Every Ranking Lever Triggers a Named Golden Failure

## Objective
Run and document the one-time source-editing mutation check proving that every ranking constant and one stopword are guarded by at least one named golden case.

## Skills Required
Use `mutation-testing` to apply one controlled source edit at a time, capture the discriminating named failure, and restore the source exactly between runs.

## Acceptance Criteria
- [ ] Independently mutating `TITLE_WEIGHT`, `TAG_WEIGHT`, `SUMMARY_WEIGHT`, `BODY_WEIGHT`, and `GRAPH_NEIGHBOR_BOOST`, and independently removing one selected stopword, causes at least one named golden case to fail for each mutation.
- [ ] Each mutation is reverted before the next mutation, and `git diff -- src/lib/prompt-retrieval.ts` is empty after the check.
- [ ] A PR-ready mutation → named-failing-case mapping records the exact edit and at least one observed case id for all six mutation arms.
- [ ] Running `npx vitest run tests/lib/prompt-retrieval-golden.test.ts` after all reverts exits `0`; running `git diff --exit-code -- src/lib/prompt-retrieval.ts` also exits `0`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Mutate only one lever per run. Because `STOPWORDS` is module-private, remove one stopword by editing `src/lib/prompt-retrieval.ts`; do not add an export or testing seam. This task produces verification evidence for the PR description, not executable mutation machinery. Do not retain any ranking change.

## Input Dependencies
Task 3's passing golden suite, both complete query corpora, and stable named case ids.

## Output Artifacts
A PR-ready six-row mapping from mutation to at least one named failing golden case, plus a clean production source tree and a final green focused suite.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Begin from a green focused golden suite and record the baseline output.
2. For each weight or boost constant, make one conspicuous temporary value change that flips that lever without altering any other logic, run the focused suite, and record the exact failing case id(s).
3. Restore the source file immediately and rerun or otherwise confirm the baseline before applying the next mutation.
4. Remove one meaningful member from the module-private `STOPWORDS` set, run the same focused suite, and record the named failure; restore it immediately.
5. If any mutation passes silently, strengthen or adjust an existing golden case in the corpus that owns that behavior, then repeat the complete affected arm. Do not change production ranking behavior.
6. Prepare a concise table suitable for the PR description with columns for lever, temporary edit, and named failing case.
7. Finish with the focused suite green and `git diff --exit-code -- src/lib/prompt-retrieval.ts` clean.

Test philosophy: write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, application-specific edge cases, data transformations, and integration points. Test this project's retrieval behavior, not framework or library functionality. This is a one-time mutation validation of the existing integration suite, not a request to add a mutation framework or comprehensive generated test matrix.

</details>
