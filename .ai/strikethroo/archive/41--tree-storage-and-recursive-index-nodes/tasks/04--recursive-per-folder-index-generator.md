---
id: 4
group: "generator"
dependencies: [2, 3]
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 7
complexity_notes: "Generalizes the single-catalog generator to a recursive per-directory emitter with global in-degree ordering, id-to-path resolution, and per-folder metrics, all under a strict byte-determinism contract."
---
# Generalize generateIndex into a recursive per-folder index-node generator with metrics

## Objective
Generalize `generateIndex` in `src/lib/index-gen.ts` from producing one root
`INDEX.md` to emitting one deterministic `index.md` per directory under
`nodes/`, recursively, as a pure function of the leaf set plus an injected
`now`. Each `index.md` rolls up its directory: child leaf nodes (title,
summary, tags) and child subfolders (a deterministic intent line plus rollup
statistics), ordered by global graph in-degree. Compute per-folder metrics
(occupancy, tag diversity, leaf size) deterministically during generation and
expose them for later consumption. All references resolve by `id`; the renderer
emits each node's current path.

## Skills Required
- **typescript**: rewrite the pure generator and rendering helpers in
  `src/lib/index-gen.ts`.

## Acceptance Criteria
- [ ] `generateIndex` walks the nested tree and returns one `index.md` body per
  directory (root included), each a rollup of its own directory only.
- [ ] Output is a pure function of the leaf set plus injected `now`; repeated
  calls over the same input are byte-identical (deterministic ordering and
  tie-breaking, no ambient clock).
- [ ] In-degree is computed globally across the whole leaf set, so ordering
  inside any folder reflects the full `relates_to` graph, not just local edges.
- [ ] Each `index.md` lists child leaf nodes with title, summary, and tags, and
  lists child subfolders with a deterministic intent line plus rollup stats,
  sorted by in-degree then title.
- [ ] `kind` (read from frontmatter) still drives the Conventions / Components
  rendering split; it does not drive directory placement.
- [ ] Every node reference is by `id`; the rendered path is the node's current
  path resolved via task 2's id-to-path map. No leaf or generated artifact
  references another node by path.
- [ ] Per-folder metrics (occupancy, tag diversity, leaf size) are computed
  deterministically and returned/exposed for Plan 4 to consume.
- [ ] Empty folders and single-child folders render a well-defined `index.md`.
- [ ] The generated `index.md` frontmatter carries the bumped `schema_version`
  from task 1 (no longer the hardcoded `1`).
- [ ] `npm run typecheck` passes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
"Path is presentation, id is identity": generation resolves ids to current
paths so later relocation never breaks a reference. Determinism is a hard
contract (`practice-determinism-contract`): sort directory entries and bullets
deterministically (in-degree DESC, then title), keep `now` injected, and never
read the wall clock inside the pure path. Index nodes are deterministic
skeletons only; no curated "folder intent" line beyond the deterministic intent
(curation is Plan 2/4). Metrics are computed and exposed here but not acted on.

## Input Dependencies
- Task 2: nested-tree loader, kind-as-facet decoupling, id-to-current-path
  resolution.
- Task 3: `nodes_hash` over leaves only (used in the index frontmatter).

## Output Artifacts
- Rewritten `generateIndex` in `src/lib/index-gen.ts` emitting one body per
  directory, plus rendering helpers for the per-folder rollup.
- A returned structure carrying per-folder metrics (occupancy, tag diversity,
  leaf size) for later consumption.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. In `src/lib/index-gen.ts`, change `generateIndex` (line ~108) so it no
   longer returns a single `GeneratedIndex`. Instead, after `readAllNodes`
   collects the full leaf set, group leaves by their containing directory and
   produce one rendered body per directory (including the root). Return a
   collection keyed by directory relative path (e.g.
   `Map<relDir, { content, metrics }>`) plus the shared `nodesHash` and
   `nodeCount`. Keep the existing public helpers (`computeInDegree`,
   `renderTagIndex`, `makeCatalogComparator`) where reusable.
2. Compute `computeInDegree` once over the whole leaf set (global), then reuse
   that map when sorting bullets in every folder.
3. For each directory, render: a header; child leaf nodes via a bullet that
   includes title, summary, and tags; and child subfolders via a line carrying
   a deterministic intent (derive it deterministically, e.g. from the folder
   name or aggregated child tags) plus rollup stats (child counts, etc.).
   Sort both lists by in-degree DESC then title (reuse
   `makeCatalogComparator`).
4. Resolve every referenced node to its current path via the id-to-path map
   from task 2 (do not compute paths from `kind`). The existing
   `relPathFromKb` (line ~20) derives a path from the file location, which is
   acceptable for the node's own current path, but any cross reference rendered
   in the body must go through id resolution, not a stored path.
5. Read `kind` from frontmatter for the Conventions (`practice`) vs Components
   (`map`) split (line ~112 today). Keep that split per folder.
6. Define explicit rendering for empty folders ("_None yet._" style, already
   present in `renderBody`) and singleton folders so every folder yields a
   valid `index.md`.
7. Inject `now` (or the time provider already used by callers) rather than
   reading the clock inside the pure function. Ensure no nondeterministic
   iteration: sort directory keys and entries.
8. Compute per-folder metrics during the same walk: occupancy (leaf count in
   the folder), tag diversity (distinct tags among the folder's leaves), and
   leaf size (e.g. estimated tokens / char length per the existing
   `estimateTokens`, line ~93). Return them in the per-folder structure.
9. Build the index frontmatter with the bumped `schema_version` from task 1
   instead of the literal `1` (line ~133/189). Use `IndexFrontmatterSchema`.
10. Run `npm run typecheck`. The signature change ripples into the
    `index rebuild` command (task 5) and the tests (task 6); those are separate
    tasks, but keep this module compiling on its own.

Do not write files to disk here beyond what `writeIndex` already does; the
per-folder write orchestration belongs to task 5.
</details>
