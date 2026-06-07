---
id: 7
group: "documentation"
dependencies: [5]
status: "completed"
created: 2026-06-05
skills:
  - technical-writing
---
# Update AGENTS.md and internals docs for the tree storage shape

## Objective
Update the project documentation to describe the new tree-over-DAG storage
shape: the nested topical folder tree, the per-folder `index.md` index-node
concept, `kind` as a pure frontmatter facet, the `nodes_hash` exclusion of
generated files, and the `schema_version` bump / clean-break note.

## Skills Required
- **technical-writing**: revise Markdown docs accurately and consistently.

## Acceptance Criteria
- [ ] `AGENTS.md`: the Structure section (and any text describing the
  `nodes/<kind>/` layout) is updated to the nested topical tree with per-folder
  `index.md`, plus the schema-version bump / clean-break note.
- [ ] `docs/internals/architecture.md`, `docs/internals/schemas.md`, and
  `docs/how-it-works.md` describe the storage shape, the index-node concept,
  and that `nodes_hash` excludes generated `index.md` files.
- [ ] Docs state `kind` is a frontmatter facet driving only the Conventions /
  Components rendering split, not directory placement; and that references are
  by `id` (path is presentation).
- [ ] No em dashes in any changed file (`practice-no-em-dashes`).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Documentation must match the implemented behavior from tasks 1 to 5. The KB
node edits called out in the plan's Documentation section are deliberately left
as uncommitted node edits for human acceptance (human-in-the-loop) and are not
part of this task's committed deliverables; this task covers the repository
docs.

## Input Dependencies
- Task 5: the final storage shape, rebuild behavior, and starter layout that the
  docs must describe.

## Output Artifacts
- Updated `AGENTS.md`, `docs/internals/architecture.md`,
  `docs/internals/schemas.md`, and `docs/how-it-works.md`.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. In `AGENTS.md`, find the Structure section and any `nodes/<kind>/`
   description. Replace with the nested topical folder tree: every folder has a
   generated `index.md` (index node); leaf nodes live in topical folders; `kind`
   is a frontmatter facet only. Add the schema-version bump and clean-break note
   (old flat KBs are rejected and require re-init; migration is a later plan).
2. In `docs/internals/architecture.md`, document the tree-over-DAG model: the
   containment tree plus the `relates_to` / `depends_on` id-based DAG overlay,
   the recursive per-folder index generator, and per-folder metrics.
3. In `docs/internals/schemas.md`, document the bumped `schema_version` and that
   `index.md` files are generated artifacts excluded from `nodes_hash`.
4. In `docs/how-it-works.md`, describe progressive disclosure via the per-folder
   index nodes and that references are by `id` (path is presentation).
5. Proofread for em dashes and remove any (`practice-no-em-dashes`).
</details>
