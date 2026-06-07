---
id: 1
group: "deterministic-core"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 6
complexity_notes: "Pure deterministic decision logic over Plan 1's per-folder metrics with a two-sided hysteresis margin (split high-water vs merge low-water with a deliberate gap) plus a split-leaf size+concept gate. The judgment is in calibrating thresholds so the tree settles instead of oscillating; the code itself is LLM-free and fully testable."
---
# Deterministic, LLM-free rebalance trigger over per-folder metrics with hysteresis

## Objective
Add a deterministic primitive in `src/commands/` that reads Plan 1's per-folder
occupancy / tag-diversity / leaf-size metrics and decides, with hysteresis
margin, whether structural rebalance work is warranted and on which branches.
When no metric trips past its threshold the primitive reports "no action" so the
expensive LLM phase can be skipped entirely (zero added cost). The trigger is
LLM-free: given the same metrics it always returns the same decision.

## Skills Required
- `typescript`: implement a deterministic command primitive that consumes the
  metrics Plan 1 computes during rebuild and emits a structured, machine-readable
  decision (which folders/branches are affected and which candidate operation
  class each trips).

## Acceptance Criteria
- [ ] A new command primitive (e.g. `rebalance trigger` / `rebalance check`) reads the per-folder metrics produced by Plan 1's rebuild and prints a deterministic, structured result listing affected branches and the candidate operation class for each (split folder, split leaf, merge, create branch), or an explicit empty "no action" result.
- [ ] Split folder fires only when a folder's occupancy is **well past** its maximum (high-water mark); merge fires only when a branch is **well below** its minimum (low-water mark); there is a deliberate gap between the two so a single borderline leaf cannot flip a folder across consecutive runs.
- [ ] Split leaf fires only when a single leaf is both past a size threshold **and** flagged as covering two or more distinct concepts (the concept signal comes from the metrics, e.g. tag diversity within the leaf; the trigger never calls an LLM to decide this).
- [ ] Create branch is signalled when the metrics indicate a novel top-level topic with no existing home (per the metrics Plan 1 exposes); if Plan 1 does not expose such a signal, document the exact metric the trigger keys on in Implementation Notes and key on it deterministically.
- [ ] Given identical metric input the primitive returns byte-identical output (deterministic; no randomness, no clock, no LLM).
- [ ] The thresholds and the hysteresis gap are named constants in one place so tests and calibration can reference them; they are documented inline.
- [ ] No em dashes in any changed file.
- [ ] `npm run typecheck` and `npm run lint` pass for the changed files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File(s) to add/modify: a new primitive under `src/commands/` plus any shared
  threshold/metrics helper it needs under `src/lib/`.
- Consume the per-folder metrics Plan 1 already computes during rebuild; do not
  recompute them from scratch unless Plan 1 exposes no reusable accessor (in
  which case read the same source of truth Plan 1 writes).
- The decision must be a deterministic primitive (no LLM, no network, no
  nondeterministic ordering); the structural reasoning is a later, quarantined
  LLM step (Task 3).
- Output must be consumable by the curate skill (Task 3): a stable, parseable
  shape (e.g. JSON to stdout) listing affected branch paths and operation class.
- No em dashes in changed files (`practice-no-em-dashes`).

## Input Dependencies
None. This is the first task. It assumes Plan 1's tree storage and per-folder
metrics exist (clean break, no backwards compatibility beyond Plan 1).

## Output Artifacts
- A deterministic `rebalance` trigger primitive under `src/commands/`.
- Named threshold + hysteresis-gap constants (shared, importable by tests).
- A documented, parseable decision output consumed by Task 3 (skill wiring) and
  Task 4 (tests).

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Locate where Plan 1 computes and persists per-folder metrics during rebuild
   (search `src/lib/` and `src/commands/` for the index/rebuild code and the
   occupancy / tag-diversity / leaf-size computation). Reuse that source of
   truth; do not fork the metric math.
2. Define named constants in one place: `FOLDER_OCCUPANCY_MAX` (split
   high-water), `BRANCH_OCCUPANCY_MIN` (merge low-water), and assert
   `BRANCH_OCCUPANCY_MIN < FOLDER_OCCUPANCY_MAX` with a real gap between them so
   the same folder cannot both want to split and want to merge. Add
   `LEAF_SIZE_SPLIT_THRESHOLD` and a `LEAF_CONCEPT_MIN` (distinct-concept count)
   for split leaf. Document each with a one-line rationale comment.
3. Implement the decision: for each folder, if occupancy > max -> candidate
   `split-folder`; if a branch's occupancy < min -> candidate `merge`; for each
   leaf, if size > threshold AND distinct concepts >= LEAF_CONCEPT_MIN ->
   candidate `split-leaf`; surface `create-branch` from the metric Plan 1 exposes
   for a homeless novel top-level topic (document which metric you key on).
4. Emit a deterministic structured result to stdout: a list of
   `{ branch, operation }` entries, sorted by branch path for stable output, or
   an explicit empty result (e.g. `[]` or `{ "actions": [] }`). No timestamps,
   no random ordering.
5. Register the primitive in the CLI entrypoint mirroring how the existing
   `src/commands/` primitives are registered (find an existing subcommand
   registration and copy the pattern).
6. Run `npm run typecheck` and `npm run lint` on the touched files. Do not
   hand-edit anything under `templates/` (it is generated).
7. Record the command name, its exact output shape, and the constant names for
   Task 3 (skill wiring) and Task 4 (tests).

</details>
