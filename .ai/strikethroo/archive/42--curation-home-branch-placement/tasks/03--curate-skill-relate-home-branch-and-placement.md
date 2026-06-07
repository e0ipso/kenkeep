---
id: 3
group: "skill"
dependencies: [1, 2]
status: "completed"
created: 2026-06-05
skills:
  - prompt-engineering
  - typescript
complexity_score: 6
complexity_notes: "Rewrites the relate phase of the curate skill to also rank index nodes and emit a home branch, threads home_folder into node write, adds the root fallback, and reports placement in the summary; touches the SKILL.md heredoc so the harness-drift lint must be respected."
---
# Curate skill: relate ranks a home branch, writer places the leaf, summary reports placement

## Objective
Extend the `relate` phase of `src/templates-source/skills/kk-curate/SKILL.md`
so the single reasoning pass that finds cross edges also ranks the existing
index nodes and returns the best-fitting **home branch**, then thread that
folder into `node write --folder` so each novel leaf lands in the chosen
existing folder (or the `nodes/` root when nothing fits well). Report the
placement decisions in the end-of-run summary. The curator must not create,
split, or merge folders, and contradiction handling stays exactly as today.

## Skills Required
- **prompt-engineering**: revise the curate SKILL.md instructions so the
  in-host curator reasons about and emits a home branch, applies the root
  fallback, and reports placement, all without a second reasoning pass.
- **typescript**: only if the harness-detector heredoc (`ENV_DETECTORS`) is
  touched, mirror the change per the drift rule; no detector change is expected.

## Acceptance Criteria
- [ ] The relate guidance directs the curator to descend the existing tree (root index node, then relevant branch index nodes) and, in the same reasoning pass that sets `relates_to` / `depends_on`, rank the existing index nodes by relevance and choose the single best-fitting home branch (an existing folder under `nodes/`).
- [ ] The chosen folder is recorded on the `add` action via the `home_folder` field (added in Task 2). `modify`, `contradict`, and `drop` actions do not set `home_folder`.
- [ ] The persistence step (Step 5, `node write`) passes the action's `home_folder` through as `--folder <relpath>` so the leaf is written into that existing folder; the printed id is unchanged and folder-independent.
- [ ] The root fallback is explicit: when no existing folder clears the relevance bar, the curator omits/null/empties `home_folder` so `node write` lands the leaf at the `nodes/` root. This is a deliberate, visible outcome, not an error, and is described as such (Plan 4 later relocates).
- [ ] The skill explicitly forbids creating, splitting, or merging folders/branches; the only structural outcome curation may produce is the root fallback.
- [ ] Dedupe is described as ranging over the whole tree, with duplicates updated in place at their current path by id (no relocation on update).
- [ ] Contradiction handling is unchanged: one conflict file per contradiction, never auto-resolved (no edits that alter Step 7's behavior).
- [ ] The end-of-run summary (Step 7) lists the placement decision per written leaf (folder chosen, or "root fallback") for human review.
- [ ] After editing the source skill, the bundled artifacts are regenerated via `npm run build` (or `npm run build:templates`) so the shipped skill copies match the source. `npm run lint` (including `lint:detect-harness`) and `npm run typecheck` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
The edit is concentrated in the `relate` action guidance and Step 5
(persistence) of the curate skill. The `node write --folder` flag and its
traversal guard come from Task 1; the `home_folder` action field comes from
Task 2. Do not duplicate the deterministic index rebuild; Step 6 already calls
`index rebuild` and Plan 1 owns index-node generation. No em dashes in changed
files (`practice-no-em-dashes`). Do not hand-edit anything under `templates/`
(it is generated); regenerate it from source instead.

## Input Dependencies
- Task 1: `node write` accepts `--folder <relpath>` with a root fallback and
  traversal rejection.
- Task 2: `CuratorActionSchema.home_folder` carries the chosen folder through
  dedup to `$SURVIVORS`.

## Output Artifacts
- Updated `src/templates-source/skills/kk-curate/SKILL.md` (relate ranking,
  home-branch emission, `--folder` threading, root fallback, placement summary,
  no-structural-change constraint).
- Regenerated bundled skill copies under `templates/` (gitignored; verified by
  rebuild + diff, not committed).
- The curate-flow behavior that Task 4's integration tests assert.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Edit `src/templates-source/skills/kk-curate/SKILL.md`. In the `relate`
   reasoning (the part of the action-drafting guidance that sets `relates_to` /
   `depends_on`), add instructions to also: descend from the root index node
   into the relevant branch index nodes, rank those existing index nodes by
   relevance to the candidate, and pick the single best-fitting existing folder
   as the home branch. Emphasize this is the same single reasoning pass, two
   outputs (cross edges + home branch). No second pass.
2. Update the `add` action description and the action object schema callout so
   an `add` may carry `home_folder` (a path relative to `nodes/`, e.g.
   `practice/tooling`). State that `modify`/`contradict`/`drop` never set it.
   The action schema in the skill is illustrative prose; keep it consistent
   with the real `CuratorActionSchema` (which now allows optional
   `home_folder`).
3. Add the root-fallback rule near the placement guidance: if no existing
   folder clears the curator's relevance bar, leave `home_folder` unset/null so
   the writer places the leaf at the `nodes/` root. Frame it as deliberate and
   visible, cleaned up later by Plan 4. It is not an error and must not trigger
   folder creation.
4. Add an explicit constraint (in the per-action Constraints subsection or a
   new placement constraint): the curator never creates, splits, or merges
   folders or branches. The root fallback is the only structural outcome
   allowed.
5. In Step 5 (Persist surviving actions via `node write`), thread the folder
   through: for each `add` (and only `add`), if the action has a non-empty
   `home_folder`, pass `--folder "<home_folder>"` to the `node write` call;
   otherwise omit `--folder` (root fallback). Keep the existing stdout-id
   capture and the rule that the printed id is folder-independent and must match
   `target_node_id` for `modify`. Clarify that `modify` (dedupe-update) writes
   in place at the existing path by id with no `--folder` and no relocation.
6. In Step 2's dedupe framing and the `dedupe` flowchart description, state that
   dedupe ranges over the whole tree (`readAllNodes` already walks all kinds);
   a duplicate updates the existing leaf in place by id at its current path.
   Behavior is unchanged, only the search surface is the whole tree.
7. Leave Step 7's conflict handling logic intact. Extend only the summary
   reporting: when reporting headline numbers and written-node count, also list
   each written leaf's placement decision (chosen folder, or "root fallback")
   so the human can review placement. Keep the existing no-conflicts fast-path
   line working.
8. Do NOT touch the `ENV_DETECTORS` heredoc or the harness-detection block;
   no detector change is in scope. If you do touch it, you must mirror the
   change per the existing drift rule and `lint:detect-harness` must pass.
9. Regenerate the bundled artifacts: run `npm run build` (or
   `npm run build:templates`). The shipped skill copies under `templates/`
   (and the per-harness install copies) must match the source. `templates/` is
   gitignored (`practice-do-not-commit-bundled-output`); verify by rebuild and
   diff, do not commit generated files.
10. Run `npm run lint` (including `lint:detect-harness`) and `npm run typecheck`;
    confirm both pass. The curate flow is human-supervised and must not be run
    in CI.

</details>
