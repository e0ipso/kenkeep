---
id: 3
group: "retrieval-eval-suite"
dependencies: [1, 2]
status: "completed"
created: 2026-07-17
skills:
  - vitest
  - retrieval-evaluation
complexity_score: 5
complexity_notes: "One data-driven suite integrates two frozen corpora, three expectation modes, and reporter-visible category counts without changing production code."
execution_profile: "standard-implementation"
---
# Build the Golden Retrieval Suite and Query Specs

## Objective
Add both declarative golden-query files and one ordinary Vitest suite that loads the frozen corpora through production APIs, asserts every case exactly, and prints a stable category-level pass summary.

## Skills Required
Use `vitest` for data-driven exact assertions and reporter-visible output, and `retrieval-evaluation` to author discriminating prompts and expectations against the production ranker.

## Acceptance Criteria
- [ ] Each corpus has a `golden-queries.yaml` whose cases contain `id`, `category`, `prompt`, and exactly one supported expectation; all expected nodes are referenced by `kk_id`, never filesystem path.
- [ ] The two files contain about 25–35 cases total across `retrieval`, `refusal`, and `multi-hop`, spanning title-, tag-, and description-driven matches and including boost-only and boost-must-not-outrank cases.
- [ ] `tests/lib/prompt-retrieval-golden.test.ts` loads nodes with `readAllNodes`, extracts ids from `match.node.frontmatter.kk_id`, evaluates refusal through `buildPromptKnowledgeContext(corpusDir, prompt) === ''`, uses top-k 5 by default, and emits a deterministic category × pass-count summary in normal Vitest output.
- [ ] The suite also proves production loading, redirect-resolved boost behavior, tie-breaking, body-only matching, and the default character budget without network, LLM, or the live `.ai/kenkeep/` tree.
- [ ] `tests/fixtures/README.md` lists the retrieval-eval fixture family and the root `AGENTS.md` Testing section includes the requested one-line pointer.
- [ ] Running `npx vitest run tests/lib/prompt-retrieval-golden.test.ts` exits `0`, reports all named cases passing, and prints category counts equal to the YAML case counts; running it twice produces the same case order and summary.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use the existing `js-yaml` dependency and plain Vitest only; do not add a custom reporter or new dependency. Validate that every case has exactly one of `expect_ids_in_top_k`, `expect_empty`, or `expect_id_present_only_via_boost`. For boost-only evaluation, demonstrate that the target is present with its matching neighbor and absent when that lexical support is removed or isolated. Preserve the existing ranker unchanged. Favor presence within top-k over brittle exact-rank checks except where deterministic tie-breaking is the property under test.

## Input Dependencies
Task 1's curated Drupal node tree and provenance documentation, and Task 2's engineered synthetic node tree, redirect ledger, and property map.

## Output Artifacts
- `tests/fixtures/retrieval-eval/drupal/golden-queries.yaml`.
- `tests/fixtures/retrieval-eval/synthetic/golden-queries.yaml`.
- `tests/lib/prompt-retrieval-golden.test.ts`.
- Minimal retrieval-eval pointers in `tests/fixtures/README.md` and `AGENTS.md`.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Define a typed runtime parser for the YAML records inside the test suite so malformed ids, categories, or multiple expectation fields fail with the case id in the error.
2. Resolve fixture paths from the test file, call `readAllNodes(nodesDir)` once per corpus, and parameterize named tests by corpus and case id.
3. For `expect_ids_in_top_k`, call `rankNodes(nodes, prompt, { maxNodes: 5 })` unless a deliberately stable case documents a tighter window, then compare expected ids with `match.node.frontmatter.kk_id`.
4. For `expect_empty`, call `buildPromptKnowledgeContext(nodesDir, prompt)` and require an exact empty string.
5. For boost-only cases, assert the target is in the normal result and disappears in a controlled no-boost comparison while the direct-match counter-case remains above any boost-only target.
6. Accumulate pass totals by the three fixed categories and print one stable summary after the suite. Keep order deterministic and avoid a custom reporter.
7. Author roughly 25–35 human-judged cases across both corpora, preferring top-5 presence assertions that measure intended relevance without overfitting exact scores.
8. Update only the two requested documentation pointers, then run the focused suite twice and compare its visible ordering and summary.

Test philosophy: write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, application-specific edge cases, data transformations, and integration points. Test this project's retrieval behavior, not Vitest, YAML, or framework functionality. Combine related scenarios in this data-driven suite, favor critical-path integration coverage over per-method unit tests, and do not create separate tests for trivial library behavior.

</details>
