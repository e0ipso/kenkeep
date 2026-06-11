---
id: 4
group: "opencode-docs"
dependencies: [3]
status: "completed"
created: 2026-06-11
skills:
  - technical-writing
---
# Documentation: OpenCode export-primary capture + ses_ normalization

## Objective
Update the AI-facing docs so they describe OpenCode's real v1.17.3 model:
`opencode export` as the transcript/usage source (not the file tree) and the
`ses_` → UUID session-id normalization.

## Skills Required
`technical-writing` — concise, accurate Markdown for AI-facing docs.

## Acceptance Criteria
- [ ] `AGENTS.md` no longer describes OpenCode capture as reading the on-disk `session/message/part` storage tree; it states OpenCode sources the transcript (and usage reads) from `opencode export`, and notes the `ses_…` → UUID normalization (alongside the existing Cursor one).
- [ ] The per-harness usage capability table's OpenCode row reflects the export source (`opencode export` parts → `tool:'read'` / `state.input.filePath`) rather than the storage `part/` tree.
- [ ] The relevant kenkeep node(s) describing OpenCode capture/storage are updated to match; ENTRY.md/GRAPH.md are regenerated if any node body changes (`node dist/cli.js index rebuild`), and `doctor` reports indexes fresh.
- [ ] Docs match the shipped behavior from Task 3; no claims beyond what shipped.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`AGENTS.md` (the Capture pipeline section and the usage capability table added by plan 49); the OpenCode-related nodes under `.ai/kenkeep/nodes/` (e.g. `harness/map-opencode-harness*`, `hooks/map-capture-hook.md`); `node dist/cli.js index rebuild` + `doctor` for index freshness.

## Input Dependencies
Task 3 (final OpenCode capture behavior).

## Output Artifacts
- Updated `AGENTS.md` and OpenCode node(s); regenerated indexes if nodes changed.

## Implementation Notes
<details>
<summary>Steps</summary>

1. Grep `AGENTS.md` and `.ai/kenkeep/nodes/` for OpenCode storage/file-tree language (`session.idle`, `storage`, `part/`, `parseOpenCodeTranscript`) and the plan-49 usage capability table OpenCode row; update them to the export model.
2. Keep edits factual and brief; cross-check identifiers against Task 3's final code (the read part is `tool:'read'` / `state.input.filePath`; transcript via `opencode export`).
3. If you edit any node body, run `node dist/cli.js index rebuild` and confirm `node dist/cli.js doctor` shows ENTRY/GRAPH fresh (a node-body edit changes `nodes_hash`). Stage the regenerated ENTRY.md/GRAPH.md/index.md with the node change.
4. Do not perform unrelated doc edits; this task only aligns OpenCode docs with the shipped behavior.
</details>
