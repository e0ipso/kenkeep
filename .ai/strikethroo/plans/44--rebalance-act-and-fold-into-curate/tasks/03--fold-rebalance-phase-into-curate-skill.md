---
id: 3
group: "skill-integration"
dependencies: [1, 2]
status: "completed"
created: 2026-06-05
skills:
  - typescript
  - prompt-engineering
complexity_score: 7
complexity_notes: "Wires the deterministic trigger, the quarantined LLM clustering step, the deterministic move primitive, the deterministic rebuild, and the structural summary into kk-curate's final phase as act-and-fold. The skill must skip the LLM phase entirely when the trigger reports no action, and confine the only non-determinism to the clustering decision behind the trigger and the commit gate."
---
# Fold the rebalance phase into kk-curate as its final, act-and-fold phase

## Objective
Extend `src/templates-source/skills/kk-curate/SKILL.md` so that, after the
curator has written leaves, curate runs a final rebalance phase: it invokes the
deterministic trigger (Task 1); if nothing trips past the hysteresis margin the
LLM phase is skipped entirely and the run ends as today; if a threshold trips,
the LLM proposes structural operations for the affected branches only, the
deterministic move primitive (Task 2) applies them as content-byte-stable
renames and drives the rebuild, and curate emits a structural summary mapping the
diff. All structural and curation changes land in one uncommitted working-tree
diff; the human accepts by commit and rejects by path-scoped restore.

## Skills Required
- `typescript`: any glue/primitive plumbing the skill calls (invoking the
  trigger and move primitives, threading their structured output).
- `prompt-engineering`: author the rebalance phase instructions in the curate
  SKILL.md so the host LLM proposes clustering only on the affected branches,
  emits the operation plan the move primitive consumes, and never runs when the
  trigger reports no action.

## Acceptance Criteria
- [ ] Rebalance is the **final phase of `/kk-curate`** only; no new required command and no new nudge are introduced.
- [ ] The phase first runs the deterministic trigger (Task 1). When the trigger reports no action, the LLM clustering step is skipped entirely (zero added LLM cost) and curate ends as it does today.
- [ ] When the trigger reports affected branches, the LLM proposes structural operations (split folder, split leaf, merge, create branch) **on the affected branches only**, and emits the operation plan in the exact shape the move primitive (Task 2) consumes.
- [ ] The skill invokes the deterministic move primitive to apply the moves and the deterministic rebuild; it does not relocate files or regenerate indexes by hand.
- [ ] All structural changes and curation changes land in one uncommitted working-tree diff; the skill never runs `git commit` or `git add` and never auto-resolves anything.
- [ ] Curate emits a **structural summary** at the end of the run mapping the structural diff (which branches, which operations, which ids minted/redirected), in addition to the existing content summary.
- [ ] The non-determinism is confined to the clustering decision: the trigger and the post-move rebuild stay deterministic, and the human review (commit/restore) is the only gate.
- [ ] If the `ENV_DETECTORS` heredoc or other harness-detected sections of the SKILL.md are touched, the `lint:detect-harness` drift check still passes (mirror any required detector changes; none are expected).
- [ ] No em dashes in any changed file.
- [ ] `npm run typecheck`, `npm run lint` (including `lint:detect-harness`), and `npm run build` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File to modify: `src/templates-source/skills/kk-curate/SKILL.md` (and any
  small glue under `src/` the phase needs). Do not edit generated `templates/`
  output by hand; rebuild it via the build.
- The rebalance phase runs after leaves are written and before/as part of the
  final deterministic rebuild, per the plan's architectural approach.
- Order of operations inside the phase: deterministic trigger -> (if tripped)
  LLM proposes ops on affected branches -> deterministic move primitive applies
  moves -> deterministic rebuild of affected index nodes + nodes_hash ->
  structural summary -> everything left uncommitted.
- Keep the existing content summary, contradiction handling
  (`practice-curator-never-auto-resolves-contradictions`), and the
  git-review gate (`practice-review-nodes-via-git`) unchanged.
- No em dashes in changed files (`practice-no-em-dashes`).

## Input Dependencies
- Task 1: the deterministic trigger command and its structured decision output.
- Task 2: the move primitive command, its input operation-plan shape, and its
  redirect format.

## Output Artifacts
- An updated `kk-curate` SKILL.md with a final, act-and-fold rebalance phase.
- The rebuilt `templates/` curate skill (via `npm run build`).
- The structural summary contract surfaced at end of run.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Read `src/templates-source/skills/kk-curate/SKILL.md` end to end. Locate where
   leaves are written and where the run currently ends (content summary, final
   rebuild). The rebalance phase slots in as the final phase.
2. Add a phase that first calls the Task 1 trigger primitive and reads its
   structured output. If the output is the empty "no action" result, state
   explicitly in the skill that the LLM clustering step is skipped and the run
   ends as before. This is the zero-added-cost path and must be unambiguous to a
   non-thinking executor.
3. If the trigger reports affected branches, instruct the host LLM to read only
   those branches and propose concrete structural operations from the four
   allowed kinds, emitting them in the exact operation-plan shape the Task 2 move
   primitive consumes (reference the shape Task 2 documented). The LLM reasons
   about clustering only; it does not move files.
4. Invoke the Task 2 move primitive with that operation plan. It applies
   content-byte-stable, id-stable renames, mints split-leaf ids + redirect, and
   drives the deterministic rebuild of the affected folders.
5. Emit a structural summary: list affected branches, the operation applied to
   each, any new ids and redirects. Keep it distinct from and additional to the
   existing content summary so the human gets a legend for the structural diff.
6. Do not commit, add, or restore anything; leave the combined diff uncommitted.
   Reaffirm the existing contradiction and git-review behavior is untouched.
7. If you touch any harness-detected region of the SKILL.md, run
   `npm run lint:detect-harness` and reconcile drift per the existing rule.
8. Restate the test philosophy is owned by Task 4; do not add tests here.
9. Run `npm run build`, `npm run typecheck`, and `npm run lint`. Fix only issues
   your change introduced.

</details>
