---
id: 2
group: "retrieval-eval-fixtures"
dependencies: []
status: "completed"
created: 2026-07-17
skills:
  - test-fixtures
  - okf-v3
complexity_score: 4
execution_profile: "standard-implementation"
---
# Author the Synthetic Retrieval Control Corpus

## Objective
Create Corpus B as a frozen 15–25-node OKF-v3 tree engineered to exercise redirect-resolved boost, boost ordering, deterministic tie-breaking, body-only matching, and character-budget truncation.

## Skills Required
Use `test-fixtures` to design controlled ranking situations and `okf-v3` to make every synthetic node load through the production node reader.

## Acceptance Criteria
- [ ] `tests/fixtures/retrieval-eval/synthetic/nodes/` contains 15–25 valid v3 leaves in topical folders, each named `<kk_id>.md`, plus a committed `.redirects.json` ledger.
- [ ] The fixture contains an edge through a retired id, a boost-only cluster, a direct-match-must-outrank-boosted counter-case, near-duplicate tie-break nodes, a body-only node, and descriptions long enough to cross the default 1,800-character rendering budget mid-list.
- [ ] A synthetic README maps each engineered node or edge cluster to the ranking property it exists to test.
- [ ] Running `find tests/fixtures/retrieval-eval/synthetic/nodes -name '*.md' -type f | wc -l` prints a value from `15` through `25`, and `test -f tests/fixtures/retrieval-eval/synthetic/nodes/.redirects.json` exits `0`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use the complete OKF-v3 frontmatter shape: `type`, `title`, `description`, `tags`, `kk_schema_version: 3`, `kk_id`, `kk_derived_from`, `kk_relates_to`, `kk_depends_on`, and `kk_confidence`, followed by markdown body content. Store nodes under topical directories, not legacy kind buckets. The redirect ledger and graph edges must use ids and must be discoverable from the on-disk corpus root used by `readAllNodes` and `rankNodes`.

## Input Dependencies
The verified scoring, tie-break, graph-neighbor, redirect, and character-budget behavior documented in plan 63.

## Output Artifacts
- `tests/fixtures/retrieval-eval/synthetic/nodes/` with synthetic leaves and `.redirects.json`.
- `tests/fixtures/retrieval-eval/synthetic/README.md` describing fixture intent.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Design the query/expected-rank relationships on paper before naming nodes so each control isolates one ranking lever.
2. Create a redirect from a retired id to a live id, then point an adjacency edge at the retired id so production redirect resolution is required for the boost.
3. Give the boost-only target no lexical overlap with its query; only its matching neighbor should make it surface. Add a separate direct lexical match with enough score to stay above a merely boosted node.
4. Make tie candidates lexically equal, then control global incoming `kk_relates_to` count; include an equal-in-degree pair whose final order is decided by `kk_id`.
5. Keep the body-only query token out of title, tags, and description. Add deliberately long descriptions to enough ranked nodes to cross `DEFAULT_MAX_CHARS` during rendering.
6. Validate filename/id agreement, topical placement, edge ids, and the `.redirects.json` shape before handing the corpus to the golden suite.

</details>
