---
id: 4
group: "index-catalog-rewrite"
dependencies: [1]
status: "pending"
created: 2026-05-13
skills:
  - technical-writing
---
# Rewrite IMPLEMENTATION.md §8/§9 and the index-and-graph KB node to describe the catalog design

## Objective

Bring `IMPLEMENTATION.md §8` and `IMPLEMENTATION.md §9` in line with the new catalog generator, and update the KB node `.ai/knowledge-base/nodes/map/map-index-and-graph-files.md` so its summary describes the no-eviction catalog rather than a token-budgeted view. Follow the project conventions of current-design framing only (no retrospective wording) and no em-dashes or hyphen-as-dash separators.

## Skills Required

- **technical-writing**: precise, current-design markdown prose that matches the project's existing voice.

## Acceptance Criteria

- [ ] `IMPLEMENTATION.md §8` describes:
  - The catalog principle (every valid node appears).
  - The three layers: INDEX = catalog, node file = detail, GRAPH = traversal.
  - In-degree-DESC sort with title ASC tiebreaker.
  - The `## By topic` block as the primary semantic-navigation axis.
  - The new section headings `## Conventions (how we build)` and `## Components (what exists)`.
  - The no-eviction guarantee.
- [ ] `IMPLEMENTATION.md §9` notes that `estimateTokens` is informational only; no functional gate depends on it.
- [ ] Neither section contains retrospective framing (no "previously", no "the old generator", no "earlier versions").
- [ ] Neither section contains em-dashes (`—`, `–`) or hyphen-as-dash (` - `) separators.
- [ ] `.ai/knowledge-base/nodes/map/map-index-and-graph-files.md` summary line and body drop the "token-budgeted view" framing and describe the catalog with the three layers.
- [ ] The KB node's `tags`, `kind`, and other frontmatter fields are not altered unless the existing values are demonstrably stale.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `IMPLEMENTATION.md` (sections 8 and 9), `.ai/knowledge-base/nodes/map/map-index-and-graph-files.md`.
- Follow markdown conventions used in the rest of `IMPLEMENTATION.md` (heading depth, table style, paragraph length).
- Honor the global feedback: no em-dashes, no hyphen-as-dash, no retrospective framing, no backwards-compat language.

## Input Dependencies

- Task 1: the final shape of the renderer determines what §8 should describe (in-degree sort, tag block, headings, footer).

## Output Artifacts

- Updated `IMPLEMENTATION.md` sections 8 and 9.
- Updated `nodes/map/map-index-and-graph-files.md`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guide</summary>

1. Read `IMPLEMENTATION.md` and locate sections 8 and 9 by heading. Note the current structure; preserve the section numbering scheme.
2. Rewrite §8 around the following outline (use full prose, not these stubs verbatim):
   - One-paragraph intro: INDEX.md is a catalog the SessionStart hook injects into every conversation; every valid node appears; per-bullet payload is title, path, and `#`-prefixed tags.
   - Three-layer model: catalog (INDEX), detail (node files), traversal (GRAPH).
   - Section structure: `## Conventions (how we build)`, `## Components (what exists)`, `## By topic`, and an optional `## Recently superseded` when applicable.
   - Sort rule: within `Conventions` and `Components`, in-degree DESC then title ASC. In `By topic`, tag bucket size DESC then alpha; titles within a bucket by in-degree DESC then alpha.
   - Header footer: `_N nodes • V valid • S superseded • ~T estimated tokens_`. `T` is observability, not a budget.
3. Update §9 (or wherever `estimateTokens` is discussed) to add one or two sentences clarifying that the function is informational only; no functional gate depends on it.
4. Open `.ai/knowledge-base/nodes/map/map-index-and-graph-files.md`. Update its description and body to drop "token-budgeted view" framing. The new summary should describe INDEX as a catalog, GRAPH as the traversal companion, and node files as the detail layer.
5. Avoid every em-dash and every hyphen-as-dash. Use commas, colons, or parentheses to break clauses.
6. Avoid retrospective framing entirely. The CHANGELOG is the sole place for "previously the index was trimmed" wording; semantic-release will generate that from the commit body.
7. Do not introduce a new AGENTS.md or CLAUDE.md section. The KB pipeline is already documented at the right level.

</details>

<details>
<summary>Out of scope for this task</summary>

- Editing other KB nodes that may mention INDEX in passing (only `map-index-and-graph-files.md` is required by the plan).
- Generating a CHANGELOG entry (semantic-release handles this from the commit message).

</details>
