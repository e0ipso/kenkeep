---
id: 4
group: "curate-conflicts"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - unit-testing
---
# Replace `pending-conflicts.json` with markdown conflict files

## Objective

Drop the JSON side-channel for curator `contradict` actions: delete `ConflictReportSchema` / `PendingConflictsFileSchema` from `src/lib/schemas.ts`, replace the writer in `src/lib/curate.ts` with a per-conflict markdown file written under `.ai/knowledge-base/conflicts/<id>.md`, delete `writePendingConflicts` and the related logging from `src/commands/curate.ts`, delete `countPendingConflicts` and the "Curator conflicts" line from `src/commands/status.ts`, add a `conflictsDir` entry to `src/lib/paths.ts`, and update `templates/claude/skills/kb-curate/SKILL.md` to read markdown files instead of JSON. Add an integration test asserting the markdown is written with valid frontmatter.

## Skills Required

- `typescript`: edits across `schemas.ts`, `curate.ts` (lib + command), `status.ts`, `paths.ts`.
- `unit-testing`: rewrite tests that asserted JSON-side-channel behavior; add the markdown-writer test.

## Acceptance Criteria

- [ ] `src/lib/schemas.ts` no longer defines `ConflictReportSchema`, `PendingConflictsFileSchema`, `ConflictReport`, or `PendingConflictsFile`. Schemas exports list is updated.
- [ ] `src/lib/curate.ts`: the `kind: 'conflict'` outcome writes `.ai/knowledge-base/conflicts/<runId>-<n>.md` with the frontmatter spec'd in the plan and the proposed body. The persist outcome is `{ kind: 'conflict' }` with no JSON-shaped `conflict` field.
- [ ] `src/commands/curate.ts`: `writePendingConflicts` is deleted. The post-run log emits one line: "N conflict(s) written to `.ai/knowledge-base/conflicts/`. Review with `git diff`." when N > 0; nothing when N == 0.
- [ ] `src/commands/status.ts`: `countPendingConflicts` and the "Curator conflicts" status line are removed.
- [ ] `src/lib/paths.ts`: a new `conflictsDir` is exported alongside the existing paths, pointing at `.ai/knowledge-base/conflicts/`.
- [ ] `templates/claude/skills/kb-curate/SKILL.md`: prompt instructs the skill to enumerate `.ai/knowledge-base/conflicts/*.md` (sorted, `status: pending`) instead of reading `pending-conflicts.json`. Resolution loop is restated in file-per-conflict terms.
- [ ] Tests that asserted JSON-shaped output (`pending-conflicts.json`, `ConflictReportSchema`, `PendingConflictsFileSchema`) are deleted or rewritten.
- [ ] A new Vitest test asserts that `runCurate` with a `contradict` action writes `.ai/knowledge-base/conflicts/<runId>-1.md` whose frontmatter contains `status: pending`, `target_node_id`, `run_id`, `candidate_origin`, `detected_at`, `proposed_kind`, `proposed_title` and whose body contains the rationale and proposed-node sections.
- [ ] `npm run build && npm test` pass.
- [ ] `grep -rn "pending-conflicts\.json\|ConflictReportSchema\|PendingConflictsFileSchema\|countPendingConflicts" src tests templates` returns no results.

## Technical Requirements

- TypeScript edits + a `gray-matter` (or equivalent already-used parser) frontmatter writer.
- Frontmatter for each conflict file (per plan §Component 3):

```yaml
---
id: <runId>-<n>
status: pending
detected_at: <ISO-8601>
run_id: <runId>
candidate_origin: _sessions/<session-file>.md
target_node_id: <node-id-or-null>
proposed_kind: practice | map
proposed_title: <title>
---
```

- Body: rationale (one section) followed by the curator's proposed node body verbatim.

## Input Dependencies

None (this work is independent of the init/doctor changes in tasks 1-3, 5).

## Output Artifacts

- Trimmed `src/lib/schemas.ts`.
- Updated `src/lib/curate.ts` with the new markdown writer.
- Trimmed `src/commands/curate.ts`.
- Trimmed `src/commands/status.ts`.
- Updated `src/lib/paths.ts` with `conflictsDir`.
- Updated `templates/claude/skills/kb-curate/SKILL.md`.
- New conflict-writer test in `tests/lib/curate.test.ts` (or the existing curate test file).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Add the new path to `src/lib/paths.ts` first: a `conflictsDir` joining the KB root with `conflicts`. Run `npm run build` to confirm no import drift.
2. In `src/lib/schemas.ts`:
   - Delete `ConflictReportSchema` (lines ~212-227) and `PendingConflictsFileSchema` (lines ~229-233).
   - Delete the corresponding TypeScript type exports (`ConflictReport`, `PendingConflictsFile`).
   - Update any exports/index re-exports.
3. In `src/lib/curate.ts`:
   - Locate the `kind: 'conflict'` persist branch (around line 415-433).
   - Replace the JSON payload accumulation with a write to `${conflictsDir}/${runId}-${n}.md` using `fs.writeFileSync` and a frontmatter serializer (use whatever the codebase already uses; if `gray-matter` is the standard, call `matter.stringify(body, frontmatter)`).
   - Compose the body as: a `## Rationale` section followed by the proposed node body (verbatim, no extra wrapping).
   - Ensure the conflicts directory exists (`mkdirSync({ recursive: true })`).
   - Update the function return so the persist outcome is `{ kind: 'conflict' }` (no `conflict` field). Adjust the consumer in `src/commands/curate.ts` accordingly.
4. In `src/commands/curate.ts`:
   - Delete `writePendingConflicts`.
   - Adjust the post-run log (around line 180-184) to emit the one-line summary spec'd above when conflicts > 0; emit nothing when conflicts == 0.
5. In `src/commands/status.ts`:
   - Delete `countPendingConflicts` and the "Curator conflicts" status line (around line 34 and 83-91 per the plan).
   - Confirm the surrounding status output remains coherent.
6. In `templates/claude/skills/kb-curate/SKILL.md`:
   - Replace any mention of `pending-conflicts.json` with the markdown-files flow: enumerate `.ai/knowledge-base/conflicts/*.md` (filter for `status: pending` in frontmatter, sort by filename), iterate, and for each, present the rationale and proposed body to the user; on acceptance, the user edits the target node and `git restore`s the conflict file; on retention as a record, the user `git commit`s the file.
7. Test audit:
   - Grep `tests/` for `pending-conflicts.json`, `ConflictReportSchema`, `PendingConflictsFileSchema`, `countPendingConflicts`. Delete or rewrite each affected test.
8. New test in `tests/lib/curate.test.ts`:
   - Set up a temp KB fixture with at least one session log triggering a `contradict` action (reuse an existing fixture if available).
   - Run `runCurate` against it.
   - Assert: `.ai/knowledge-base/conflicts/<runId>-1.md` exists; parse its frontmatter and verify all required keys; verify the body contains the rationale section and the proposed node body.
   - Clean up in `afterEach`.
9. Run `npm run build && npm test`. Run the stale-reference grep.

</details>
