---
id: 3
group: "documentation"
dependencies: [1]
status: "completed"
created: 2026-05-25
skills:
  - markdown
---
# Update KB nodes and project documentation

## Objective
Remove all documentation that describes secretlint as a built-in capture-time feature. Delete the obsolete KB practice node, update related map/practice nodes, regenerate INDEX/GRAPH, and align AGENTS.md and README.md with the simplified capture flow.

## Skills Required
Markdown editing for KB nodes and project docs; use existing CLI primitives for deterministic INDEX/GRAPH regeneration.

## Acceptance Criteria
- [ ] `nodes/practice/practice-capture-runs-secretlint-with-redaction.md` is deleted
- [ ] `nodes/practice/practice-init-does-not-install-commit-tooling.md` no longer references capture-time secretlint redaction
- [ ] `nodes/map/map-capture-hook.md` drops step 4 (secretlint preset) and the secretlint failure mode from its table
- [ ] `INDEX.md` and `GRAPH.md` are regenerated after node changes (deterministic output)
- [ ] `AGENTS.md` capture pipeline section no longer mentions secretlint redaction (approximately lines 93, 101, 105)
- [ ] `README.md` is checked for secretlint mentions and updated if any remain
- [ ] `npm run lint` passes (KB lint included)
- [ ] No dangling `relates_to` / `depends_on` edges pointing at the deleted node id

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- KB nodes live under `.ai/knowledge-base/nodes/`
- Regenerate index/graph via `node dist/cli.js index rebuild` (or equivalent primitive) after node edits
- Follow [practice-no-em-dashes](.ai/knowledge-base/nodes/practice/practice-no-em-dashes.md) in all prose edits
- Grep other KB nodes for `practice-capture-runs-secretlint-with-redaction` references and update cross-links

## Input Dependencies
- Task 1: final capture pipeline behavior (no scanning) is the source of truth for documentation wording

## Output Artifacts
- Deleted: `.ai/knowledge-base/nodes/practice/practice-capture-runs-secretlint-with-redaction.md`
- Modified: `practice-init-does-not-install-commit-tooling.md`, `map-capture-hook.md`, `AGENTS.md`, `README.md` (if needed)
- Regenerated: `.ai/knowledge-base/INDEX.md`, `.ai/knowledge-base/GRAPH.md`
- Any other KB nodes with stale secretlint cross-references updated

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Delete `.ai/knowledge-base/nodes/practice/practice-capture-runs-secretlint-with-redaction.md`.
2. Grep `.ai/knowledge-base/nodes/` for references to `practice-capture-runs-secretlint-with-redaction`, `secretlint`, and `secret_scan`. Update or remove cross-links in affected nodes.
3. Edit `nodes/practice/practice-init-does-not-install-commit-tooling.md`:
   - Remove language implying the library performs capture-time secretlint redaction.
   - Keep the distinction that `init` does not install commit-time tooling (husky/lint-staged) — that remains accurate.
4. Edit `nodes/map/map-capture-hook.md`:
   - Remove step 4 describing secretlint with the recommended preset.
   - Remove the secretlint failure mode row from any troubleshooting/status table.
   - Describe capture as: parse transcript → render session log → write to `_sessions/`.
5. Edit `AGENTS.md`:
   - Update the "Capture and curation pipeline" bullets (approximately lines 93, 101, 105) to remove secretlint redaction mentions.
   - Reflect that secret scanning is an end-user pre-commit concern, not a library feature.
6. Grep `README.md` for `secretlint`; remove or reword any mentions.
7. Regenerate KB index and graph:
   ```bash
   node dist/cli.js index rebuild
   ```
   Confirm deterministic output (no timestamps in INDEX/GRAPH).
8. Run `node dist/cli.js lint --verbose` and fix any dangling edges or naming violations introduced by the deletion.
9. Run `npm run lint` for the full project.

</details>
