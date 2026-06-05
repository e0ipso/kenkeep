---
id: 2
group: "storage-shape"
dependencies: [1]
status: "completed"
created: 2026-06-05
skills:
  - typescript
  - filesystem
complexity_score: 6
complexity_notes: "Touches the directory-walk model, kind interpretation, and lint naming rules together; central to the storage-shape change."
---
# Store leaves in a topical folder tree and make kind a pure facet

## Objective
Replace the flat `nodes/<kind>/` storage model with a nested topical folder
tree where leaf nodes live in topical folders and `kind` (`map` / `practice`) is
a pure frontmatter facet that drives only the Conventions / Components rendering
split. Update the lint naming rules to drop kind/directory agreement while
asserting filename/id agreement and that every leaf carries a stable id.

## Skills Required
- **typescript**: change the node-loading / directory-walk model and lint rules.
- **filesystem**: walk an arbitrarily nested `nodes/` tree rather than two fixed
  `<kind>/` buckets.

## Acceptance Criteria
- [ ] The node loader walks a nested topical folder tree under `nodes/` and
  collects leaf nodes from any depth, not just `nodes/map/` and
  `nodes/practice/`.
- [ ] `kind` no longer determines or constrains directory placement; it is read
  from frontmatter and used only to drive the Conventions / Components split in
  index rendering (consumed by task 3).
- [ ] The lint naming rules (`practice-lint-naming-rules`) are updated:
  filename/id agreement is asserted; every leaf carries a stable id; every
  folder under `nodes/` has an `index.md`; the old kind/directory agreement
  assertion is removed.
- [ ] References between nodes resolve by `id` only; the loader exposes an
  id-to-current-path resolution used by index generation (consumed by task 3).
- [ ] `npm run typecheck` and `npm run lint` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
"Path is presentation, id is identity." The loader must key nodes by `id` and be
able to report each node's current path. Directory iteration must be
deterministic (sorted) so downstream generation is byte-stable. A topic tree
cannot be organized by the two-value `kind` axis, so kind is decoupled from
placement here.

## Input Dependencies
- Task 1: bumped schema and the new reader that rejects the old flat layout.

## Output Artifacts
- Updated node loader that walks a nested tree and resolves id to current path.
- Updated lint naming rules in the lint implementation.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Find the current node-loading code that enumerates `nodes/<kind>/` (search
   `src/lib/nodes.ts` and `src/lib/index-gen.ts` for how the node set is
   gathered). Replace the fixed two-bucket walk with a recursive directory walk
   that collects every leaf node file (excluding generated `index.md`) at any
   depth under `nodes/`. Sort directory entries deterministically.
2. Read `kind` from each leaf's frontmatter. Ensure nothing derives a node's
   directory from `kind` anymore. The Conventions vs Components rendering split
   must now read `kind` from frontmatter (wire this so task 3's generator can
   use it).
3. Build/keep an id-keyed index of nodes with each node's current relative path,
   so index generation (task 3) and graph generation resolve `id` to path.
4. Update the lint naming rules: locate the lint that currently asserts
   filename / id / kind / directory agreement. Drop the kind/directory
   assertion. Keep/assert: filename matches id, leaf carries a stable id, and
   every folder under `nodes/` contains an `index.md`.
5. Run `npm run typecheck` and `npm run lint`; fix fallout.

Do not implement the recursive index rendering itself here (task 3) or the
nodes_hash change (task 4); just the storage/walk model, kind decoupling, and
lint rules.
</details>
