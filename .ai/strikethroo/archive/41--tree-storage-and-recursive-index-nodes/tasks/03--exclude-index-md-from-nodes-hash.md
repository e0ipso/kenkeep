---
id: 3
group: "storage-shape"
dependencies: [2]
status: "completed"
created: 2026-06-05
skills:
  - typescript
---
# Compute nodes_hash over leaf nodes only and exclude generated index.md

## Objective
Make `computeNodesHash` in `src/lib/nodes.ts` hash leaf nodes only and
explicitly exclude every generated `index.md` from the walk, so the hash that
detects source drift is not self-referential. The hash must be stable across
repeated rebuilds.

## Skills Required
- **typescript**: edit the recursive markdown walk in `src/lib/nodes.ts`.

## Acceptance Criteria
- [ ] `computeNodesHash` walks the nested `nodes/` tree and includes only leaf
  node files, skipping every file named `index.md` at any depth.
- [ ] No generated artifact (`index.md`, and any root `INDEX.md` / `GRAPH.md`
  if present under the hashed dir) contributes to the hash.
- [ ] The hash is byte-stable across repeated rebuilds for an unchanged leaf
  set (no self-reference: regenerating `index.md` must not change the hash).
- [ ] `npm run typecheck` passes for the changed file.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Generated artifacts must not feed the hash that detects source drift, or the
hash becomes self-referential and every rebuild perturbs it. The existing
`walkMarkdown` helper already recurses; the change is to exclude `index.md`
(and not to include it via any code path). Keep the existing sort-then-sha256
contract so the hash stays deterministic and mtime-independent.

## Input Dependencies
- Task 2: the nested-tree node loader and the convention that every folder
  carries a generated `index.md`.

## Output Artifacts
- Updated `computeNodesHash` / `walkMarkdown` in `src/lib/nodes.ts` that
  excludes `index.md` from the hashed entry set.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. In `src/lib/nodes.ts`, `computeNodesHash` (line ~123) calls `walkMarkdown`
   (line ~132). In `walkMarkdown`, when iterating directory entries, skip any
   file whose name is exactly `index.md` before computing its sha and pushing
   it to `out`. Keep the existing `.md` filter and the `<rel>\t<sha>` entry
   format, the lexicographic sort, and the final `sha256(joined)`.
2. Confirm no other code path adds `index.md` (or a root `INDEX.md`/`GRAPH.md`)
   into the hashed set. Leaf nodes only.
3. Preserve mtime-independence and determinism (`practice-determinism-contract`):
   the entry list is content + relative-path based and sorted, so two rebuilds
   over the same leaf set yield an identical hash even after `index.md` files
   are (re)written.
4. Run `npm run typecheck` and fix any fallout.

Do not implement the recursive index rendering here (task 4); this task only
changes what the hash covers.
</details>
