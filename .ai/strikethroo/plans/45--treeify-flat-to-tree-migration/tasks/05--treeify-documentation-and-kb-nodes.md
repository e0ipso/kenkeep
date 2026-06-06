---
id: 5
group: "treeify-verification"
dependencies: [3]
status: "completed"
created: 2026-06-05
skills:
  - technical-writing
---
# Documentation: treeify migration docs and uncommitted KB nodes

## Objective
Document the treeify migration as required by the plan's Documentation section. Update the user-facing docs to explain how to migrate an existing knowledge base with treeify and that it is one-time and supervised, update `AGENTS.md` to note the migration path for the Plan 1 layout change, and write the two knowledge-base nodes (a map node for the treeify command and a practice node mirroring the bootstrap supervision and never-overwrite rules for migration). The KB nodes are written to disk and left uncommitted for human acceptance, consistent with the supervised model.

## Skills Required
- `technical-writing`: update existing docs and `AGENTS.md` and author two KB node files in the project's node format.

## Acceptance Criteria
- [x] `docs/installation.md` explains how to migrate an existing flat KB to the tree layout with treeify, stating it is one-time and supervised (write-to-disk, review by git diff, accept by commit, reject by restore).
- [x] `docs/troubleshooting.md` covers treeify migration, including the refuse-on-already-migrated behavior and what to do (curate / rebalance) and that a partial result can be discarded with git restore.
- [x] `AGENTS.md` notes the migration path for the layout change introduced in Plan 1 (existing flat KBs migrate via treeify rather than re-bootstrapping).
- [x] A new map node for the treeify command is written under the KB nodes directory (mirroring `map-kk-bootstrap-skill` / `map-bootstrap-incremental-command`), describing what treeify does and how it is invoked.
- [x] A new practice node is written mirroring `practice-bootstrap-is-supervised-and-judgmental` and `practice-bootstrap-never-overwrites-existing-nodes`, stating that migration is supervised and never overwrites without review and never commits.
- [x] The two KB nodes are left uncommitted (written to disk only); this task does not commit them.
- [x] No em dashes in any changed file (`practice-no-em-dashes`).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Match the existing structure and tone of `docs/installation.md` and `docs/troubleshooting.md`; do not restructure the docs site.
- Author the KB nodes in the exact node frontmatter/format used by existing nodes under the kenkeep nodes directory; reuse ids/edge conventions and reference related nodes (`map-bootstrap-incremental-command`, the bootstrap practice nodes) where appropriate.
- Do not commit the KB nodes; the human accepts them by git commit per the supervised model.
- Documentation should reflect the behavior actually implemented in Task 3 (refusal message wording, command name); read the launcher before writing so the docs match.

## Input Dependencies
- Task 3: the treeify command name, invocation, refusal message, and behavior must be settled so docs and the map node describe the real command.

## Output Artifacts
- Updated `docs/installation.md`, `docs/troubleshooting.md`, and `AGENTS.md`.
- New map node (treeify command) and new practice node (migration supervision / never-overwrite) under the KB nodes directory, left uncommitted.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read Task 3's implemented `treeify` command to confirm the command name, exact refusal message, and the write-then-stop supervised flow so the docs match reality.
2. Update `docs/installation.md`: add a section on migrating an existing flat KB with treeify, emphasizing it is one-time and supervised (writes files, then you review by `git diff` and accept by `git commit` or reject by `git restore`).
3. Update `docs/troubleshooting.md`: document the refuse-on-already-migrated case (and that the fix is to use curate / rebalance), and that an interrupted/partial run is visible in `git status` and discardable with `git restore`.
4. Update `AGENTS.md`: add a note that the Plan 1 layout change is crossed by existing KBs via the one-time supervised treeify migration, not by re-bootstrapping.
5. Locate existing nodes `map-kk-bootstrap-skill`, `map-bootstrap-incremental-command`, `practice-bootstrap-is-supervised-and-judgmental`, and `practice-bootstrap-never-overwrites-existing-nodes` to copy their exact node file format and edge conventions.
6. Write a new map node for the treeify command and a new practice node for migration supervision / never-overwrite, in that same format, under the KB nodes directory. Leave them uncommitted (do not run git).
7. Keep every changed and new file free of em dashes.

</details>
