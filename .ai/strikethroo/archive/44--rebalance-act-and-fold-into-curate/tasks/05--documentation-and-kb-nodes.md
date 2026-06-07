---
id: 5
group: "documentation"
dependencies: [3]
status: "completed"
created: 2026-06-05
skills:
  - technical-writing
---
# Document the rebalance phase: docs, AGENTS.md, and KB nodes

## Objective
Update the project documentation to describe rebalance as the final phase of
curate, the act-and-fold review model, and the four structural operations, and
leave the required kenkeep KB nodes uncommitted for human acceptance. This is the
documentation deliverable listed in the plan's Documentation section.

## Skills Required
- `technical-writing`: update user/architecture docs and author/update KB nodes
  accurately and concisely, matching the existing voice and conventions.

## Acceptance Criteria
- [ ] `docs/how-it-works.md` describes rebalance as curate's final phase: the deterministic hysteresis-gated trigger, the four operations, content-byte-stable id-stable renames, the structural summary, and that the LLM phase is skipped when nothing trips.
- [ ] `docs/daily-use.md` describes the act-and-fold review model: structural and curation changes land in one diff; accept by `git commit`, reject just the structural moves by path-scoped `git restore`; no new command and no new nudge.
- [ ] `AGENTS.md` updates the pipeline description to capture / curation / rebalance / discovery.
- [ ] KB nodes are added/updated and left **uncommitted** for human acceptance: a new practice node for the rebalance trigger and hysteresis; a new map node for the rebalance phase and the move primitive; updates to `map-curate-command` and `practice-review-nodes-via-git`.
- [ ] No em dashes in any changed or new file (`practice-no-em-dashes`).
- [ ] Documentation is consistent with what Task 3 actually shipped (no aspirational behavior).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files to modify: `docs/how-it-works.md`, `docs/daily-use.md`, `AGENTS.md`.
- KB nodes live under the kenkeep nodes tree; author the new practice and map
  nodes and update `map-curate-command` and `practice-review-nodes-via-git`
  following the existing node format. Leave them uncommitted (do not `git add` /
  commit); the human accepts by leaving them and rejects by deleting them.
- No em dashes anywhere (`practice-no-em-dashes`).

## Input Dependencies
- Task 3: the curate rebalance phase must be implemented so the docs describe
  real behavior. (Tasks 1 and 2 are transitively covered via Task 3.)

## Output Artifacts
- Updated `docs/how-it-works.md`, `docs/daily-use.md`, `AGENTS.md`.
- New rebalance-trigger practice node and rebalance-phase/move-primitive map
  node; updated `map-curate-command` and `practice-review-nodes-via-git`, all
  left uncommitted.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Read the current `docs/how-it-works.md`, `docs/daily-use.md`, and `AGENTS.md`
   to match structure and voice, and read the existing KB nodes named in the plan
   (`map-curate-command`, `practice-review-nodes-via-git`,
   `practice-determinism-contract`, the bootstrap nodes) for node format.
2. In `how-it-works.md`, add rebalance as curate's final phase: the deterministic
   LLM-free trigger over Plan 1 metrics, hysteresis margin (so the tree settles),
   the four operations on affected branches only, content-byte-stable id-stable
   renames, split-leaf new ids + redirect, the post-move deterministic rebuild,
   and the structural summary. Note the LLM phase is skipped at zero cost when
   nothing trips.
3. In `daily-use.md`, document act-and-fold: one combined diff; accept by commit,
   reject structural moves by path-scoped restore; no new command, no new nudge.
4. In `AGENTS.md`, update the pipeline line to capture / curation / rebalance /
   discovery.
5. Author the KB nodes: a practice node for the trigger + hysteresis; a map node
   for the rebalance phase and the move primitive; update `map-curate-command`
   (now ends with rebalance) and `practice-review-nodes-via-git` (path-scoped
   restore rejects structural moves). Leave all KB node changes uncommitted.
6. Grep your changes for em dashes and remove any. Keep prose concise and
   accurate to shipped behavior.

</details>
