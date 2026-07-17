---
id: 1
group: "retrieval-eval-fixtures"
dependencies: []
status: "completed"
created: 2026-07-17
skills:
  - fixture-curation
  - okf-v3
complexity_score: 4
execution_profile: "standard-implementation"
---
# Vendor the Curated Drupal Retrieval Corpus

## Objective
Create Corpus A as a frozen, connected 25–40-node subset of the real Drupal knowledge pack, pinned to the required upstream commit and accompanied by its provenance, license, and refresh documentation.

## Skills Required
Use `fixture-curation` to choose and vendor a coherent connected sub-cluster, and `okf-v3` to preserve loader-valid node documents and id-based graph edges.

## Acceptance Criteria
- [ ] `tests/fixtures/retrieval-eval/drupal/nodes/` contains 25–40 upstream OKF-v3 leaves copied from `e0ipso/kenkeep-pack-drupal` at SHA `9da328b488577b0679d79721f4f4c68045ee2cd3`, without using `pack import`.
- [ ] The selected nodes form a connected sub-cluster for every graph edge intended for later golden cases; no authored boost path will depend on an excluded node.
- [ ] The corpus preserves the applicable upstream LICENSE and has a README documenting the pinned SHA, selection criteria, exact refresh procedure, and the requirement to re-author affected goldens after refresh.
- [ ] Running `find tests/fixtures/retrieval-eval/drupal/nodes -name '*.md' -type f | wc -l` prints a value from `25` through `40`, and `rg -n '9da328b488577b0679d79721f4f4c68045ee2cd3' tests/fixtures/retrieval-eval/drupal/README.md` prints the pinned-SHA documentation line.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Copy only markdown leaves from the upstream pack's `knowledge/` tree. Preserve the original OKF-v3 frontmatter and filenames, keep topical directories, and never create legacy bare `practice/` or `map/` buckets. Goldens will refer to `kk_id`, so path layout is presentation only. Do not modify production retrieval code or introduce test-time network access.

## Input Dependencies
The upstream `kenkeep-pack-drupal` repository at commit `9da328b488577b0679d79721f4f4c68045ee2cd3` and the OKF-v3 schema enforced by `readAllNodes`.

## Output Artifacts
- `tests/fixtures/retrieval-eval/drupal/nodes/` with the curated corpus.
- `tests/fixtures/retrieval-eval/drupal/README.md` with provenance and refresh instructions.
- A preserved upstream license file alongside the corpus.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Fetch or inspect the pinned upstream commit only during development; the committed fixture must be self-contained and offline afterward.
2. Start from one useful Drupal domain cluster, then expand through `kk_relates_to` neighbors until the subset is 25–40 leaves and supports realistic title-, tag-, description-, and graph-adjacency queries.
3. Copy upstream leaves verbatim from `knowledge/`; do not run `pack import`, because its manifest path and initialized-repo behavior are explicitly out of scope.
4. Check each retained boost edge's endpoint is also in the subset. Dangling unrelated edges may remain, but do not design a golden around them.
5. Preserve upstream licensing and write a deterministic refresh recipe that names the source repository, commit pin, selection rule, copy operation, and golden revalidation step.
6. Run the acceptance commands and inspect the copied frontmatter for `kk_schema_version: 3` and stable `kk_id` values.

</details>
