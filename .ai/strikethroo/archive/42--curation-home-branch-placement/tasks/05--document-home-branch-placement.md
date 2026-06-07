---
id: 5
group: "documentation"
dependencies: [3]
status: "completed"
created: 2026-06-05
skills:
  - technical-writing
---
# Document home-branch placement in user docs and KB nodes

## Objective
Update the user-facing documentation and the relevant knowledge-base nodes to
describe the new curation behavior: the curation flow now names a home branch
for each novel leaf, places it into an existing folder (or the `nodes/` root
when nothing fits), keeps identity independent of placement, and never creates,
splits, or merges folders.

## Skills Required
- **technical-writing**: revise `docs/how-it-works.md` and `docs/daily-use.md`
  and author/update the placement-related KB nodes in present-tense end-state
  prose.

## Acceptance Criteria
- [ ] `docs/how-it-works.md` describes that curation's relate step ranks existing index nodes and picks a home branch in the same reasoning pass that sets cross edges, and that the leaf is written into that existing folder with a stable, folder-independent id.
- [ ] `docs/daily-use.md` reflects the user-visible change: the curate run names where each new leaf lives and reports placement decisions in its end-of-run summary; the human still reviews by git diff and accepts by commit or rejects by restore.
- [ ] The docs state the root fallback (no good fit lands the leaf at the `nodes/` root) and that curation never creates, splits, or merges folders (structure changes belong to Plan 4), without referencing plan/ticket ids in committed KB node bodies.
- [ ] The KB nodes `map-curate-command` and `map-curator-action` are updated to reflect the home-branch step and the optional `home_folder` action field, and a new or updated practice node describes home-branch placement plus the root fallback. KB node files are left uncommitted under `.ai/kenkeep/nodes/` for human acceptance.
- [ ] No em dashes in any changed file (`practice-no-em-dashes`); no change-oriented/transition framing in KB node bodies (present-tense end state only); no plan/ticket/issue references in KB node bodies.
- [ ] Documentation reads as current end state, consistent with the new layout; no backwards-compatibility or migration narrative.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Edit the existing docs in place. KB node files follow the kenkeep node schema
and conventions (present-tense, project-specific, no history). The KB nodes are
deliberately left uncommitted so the human accepts them via the normal kenkeep
review gate; do not stage or commit them. No em dashes (`practice-no-em-dashes`).

## Input Dependencies
- Task 3: the curate skill defines the home-branch behavior, the root fallback,
  and the placement summary that the docs and KB nodes describe.

## Output Artifacts
- Updated `docs/how-it-works.md` and `docs/daily-use.md`.
- Updated KB nodes `.ai/kenkeep/nodes/map/map-curate-command.md` and
  `.ai/kenkeep/nodes/map/map-curator-action.md` (left uncommitted).
- A new or updated practice node under `.ai/kenkeep/nodes/practice/` describing
  home-branch placement and the root fallback (left uncommitted).

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Read the current `docs/how-it-works.md` and `docs/daily-use.md` and find the
   sections describing curation / the curate flow. Update them so the relate
   step is described as producing both cross edges and a home branch in one
   reasoning pass, and the writer places the leaf into the chosen existing
   folder with a stable, folder-independent id.
2. Add the root-fallback description (no good fit lands at the `nodes/` root)
   and the no-structural-change rule (curation never creates, splits, or merges
   folders). Keep wording present-tense and end-state; do not narrate the change
   from the old `nodes/<kind>/` layout.
3. In `docs/daily-use.md`, note that the curate run reports its placement
   decisions in the end-of-run summary and that the human review gate
   (git diff, commit to accept, restore to reject) is unchanged.
4. Update `.ai/kenkeep/nodes/map/map-curate-command.md` to mention the
   home-branch placement step and the placement summary. Update
   `.ai/kenkeep/nodes/map/map-curator-action.md` to mention the optional
   `home_folder` field on `add` actions.
5. Author (or update) a practice node under
   `.ai/kenkeep/nodes/practice/` (e.g.
   `practice-curator-places-leaf-into-existing-home-branch.md`) describing the
   rule: curation places each new leaf into the best-fitting existing folder via
   the relate ranking, identity is the id and is independent of folder, and a
   leaf with no good fit lands at the `nodes/` root; curation never creates,
   splits, or merges folders. Use the kenkeep node frontmatter schema
   (`schema_version`, `id`, `title`, `kind`, `tags`, `derived_from`,
   `relates_to`, `confidence`, `summary`) consistent with sibling nodes.
6. Keep all KB node bodies in present-tense end-state prose, project-specific,
   with no plan/ticket/issue references and no history/transition framing. Do
   not commit the KB node files; leave them on disk for human acceptance.
7. Proofread every changed file for em dashes and remove them.

</details>
