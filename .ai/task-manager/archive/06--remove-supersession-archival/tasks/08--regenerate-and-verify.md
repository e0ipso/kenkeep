---
id: 8
group: "verification"
dependencies: [2, 3, 4, 5, 6, 7]
status: "completed"
created: 2026-05-13
skills:
  - bash
  - build-verification
---
# Regenerate INDEX/GRAPH and run the full plan validation gauntlet

## Objective

Run the deterministic INDEX/GRAPH regeneration against the rewritten node tree, then execute the full success-criteria sweep from the plan: build, typecheck, tests, lint, schema-key inspection, and a repo-wide grep for any leftover reference to the removed feature. Commit the regenerated INDEX.md and GRAPH.md alongside the rest of the change.

## Skills Required

- bash: run the CLI build, regeneration command, test/typecheck/lint, and the grep sweeps.
- build-verification: interpret failures and route them back to the relevant earlier task only if a regression slipped through.

## Acceptance Criteria

- [ ] `npm install` succeeds, then `npm run build` succeeds.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` are each green.
- [ ] `ai-knowledge-base index rebuild` (or the equivalent local invocation against the built CLI) regenerates `.ai/knowledge-base/INDEX.md` and `.ai/knowledge-base/GRAPH.md` from the rewritten nodes.
- [ ] `head -n 12 .ai/knowledge-base/INDEX.md` shows the header line `_N nodes • ~T estimated tokens_` for the current N (expected 41) and a deterministic T value. The header contains no `valid` or `superseded` counts.
- [ ] `grep -n "Recently superseded" .ai/knowledge-base/INDEX.md` returns empty.
- [ ] `grep -nE "^- \*\*(status|supersedes|superseded_by):" .ai/knowledge-base/GRAPH.md` returns empty.
- [ ] `grep -rnE "^(valid_from|valid_until|updated|superseded_by|supersedes):" .ai/knowledge-base/nodes` returns empty.
- [ ] `grep -rn "Recently superseded\|RECENT_SUPERSEDED_LIMIT\|valid_until\|superseded_by\|valid_from\|supersedes" src tests docs IMPLEMENTATION.md src/templates-source` returns empty (modulo a CHANGELOG entry if one was added; CHANGELOG is exempt).
- [ ] Schema key inspection: `node -e "import('./dist/lib/schemas.js').then(m => console.log(Object.keys(m.NodeFrontmatterSchema.shape)))"` prints a key list containing none of `valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`. (Adjust import shape to match the build output format; the goal is to observe the live schema, not the source.)
- [ ] Crafted-fixture curate dry-run: a fixture session with one `contradict` candidate produces a `.ai/knowledge-base/.state/pending-conflicts.json` whose `proposed_node` validates against `CuratorProposedNodeSchema` and carries none of the four removed fields. The `/kb-curate` SKILL.md describes only Replace and Reject.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- This task does no source editing. If a grep or test fails, route the fix to the appropriate earlier task (re-open it) rather than patching here.
- The regenerated INDEX.md and GRAPH.md should be committed; they are deterministic outputs and their bytes are part of the change set.
- The crafted-fixture dry-run can reuse an existing fixture (preferred) or be assembled inline. The point is to exercise the persistence path end-to-end.

## Input Dependencies

- Tasks 2, 3, 4, 5, 6, 7 all completed. (Task 1 is a transitive dependency through all of them.)

## Output Artifacts

- Regenerated `.ai/knowledge-base/INDEX.md` and `.ai/knowledge-base/GRAPH.md`.
- A clean run-log of the verification commands.

## Implementation Notes

<details>
<summary>Step-by-step verification sequence</summary>

1. **Fresh install and build:**
   ```
   npm install
   npm run build
   ```
   Both must succeed before proceeding.

2. **Run the full quality bar:**
   ```
   npm test
   npm run typecheck
   npm run lint
   ```
   Each must be green. A failure means a regression that should have been caught by tasks 2, 3, or 6; re-open the relevant task and address there rather than patching here.

3. **Schema key inspection.** Resolve the actual built path (likely `dist/lib/schemas.js` or `dist/lib/schemas.mjs`). Then:
   ```
   node -e "import('./dist/lib/schemas.js').then(m => console.log(Object.keys(m.NodeFrontmatterSchema.shape)))"
   ```
   Output must contain none of `valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`. Repeat for `CuratorProposedNodeSchema`.

4. **Regenerate INDEX and GRAPH:**
   ```
   ai-knowledge-base index rebuild
   ```
   (Or `node dist/cli.js index rebuild` against the local build, whichever the project documents.) Commit the resulting `.ai/knowledge-base/INDEX.md` and `.ai/knowledge-base/GRAPH.md`.

5. **Header check:**
   ```
   head -n 12 .ai/knowledge-base/INDEX.md
   ```
   Confirm the header line shape `_N nodes • ~T estimated tokens_`.

6. **Negative greps:**
   ```
   grep -n "Recently superseded" .ai/knowledge-base/INDEX.md
   grep -nE "^- \*\*(status|supersedes|superseded_by):" .ai/knowledge-base/GRAPH.md
   grep -rnE "^(valid_from|valid_until|updated|superseded_by|supersedes):" .ai/knowledge-base/nodes
   grep -rn "Recently superseded\|RECENT_SUPERSEDED_LIMIT\|valid_until\|superseded_by\|valid_from\|supersedes" \
     src tests docs IMPLEMENTATION.md src/templates-source
   ```
   All must return empty. (If a CHANGELOG entry was added, exclude it: pipe through `grep -v CHANGELOG`.)

7. **Crafted curate dry-run.** Either reuse the `bravo-insider` fixture (now updated by task 6) or assemble a minimal session containing one `contradict` candidate. Run the curate command, then inspect `.ai/knowledge-base/.state/pending-conflicts.json`:
   - Parse it against `PendingConflictsFileSchema` (a one-line `node -e` is fine).
   - Confirm `conflicts[0].proposed_node` has none of `supersedes`, `valid_from`, `valid_until`, `superseded_by`.
   - Confirm `src/templates-source/claude/skills/kb-curate/SKILL.md` body contains exactly the two resolution options:
     ```
     grep -nE "(supersede|keep both)" src/templates-source/claude/skills/kb-curate/SKILL.md
     ```
     returns empty.

8. **If any check fails**, identify which earlier task owns the offending file and re-open it. This task is verification only.

9. **Final**: confirm `git status` shows the regenerated INDEX.md and GRAPH.md as modified; stage them with the rest of the change.

</details>
