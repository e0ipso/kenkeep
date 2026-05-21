---
id: 4
group: "cursor-adapter"
dependencies: [2]
status: "completed"
created: "2026-05-21"
skills:
  - typescript
---
# Implement Cursor agent JSONL transcript parser

## Objective

`src/harnesses/cursor/transcript.ts` parses Cursor agent transcript JSONL (user/assistant lines with `message.content[].text`), maps roles to the shared `RoleTaggedTranscript` shape, and wires `cursorAdapter.parseTranscript` / `renderTranscript` in `index.ts`.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `parseCursorTranscript(input: string | Readable): Promise<RoleTaggedTranscript>` (or sync equivalent matching Codex API) handles Cursor JSONL lines with `role: user|assistant` and text in `message.content[]`
- [ ] Maps `user` → `'user'`, `assistant` → `'agent'`; skips tool-only turns without extractable text
- [ ] Reuses shared `renderRoleTagged` for `renderTranscript`
- [ ] `cursorAdapter.parseTranscript` / `renderTranscript` delegate to these functions (replace Task 2 placeholders)
- [ ] Fixture JSONL under `tests/fixtures/cursor-transcript/` (or similar) with at least user + assistant text lines
- [ ] `tests/harnesses/cursor/transcript.test.ts` asserts interleaved role-tagged output
- [ ] Task 3 `kb-capture` successfully imports and uses the parser in capture smoke test
- [ ] `npm run build` and `npm test` pass

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/cursor/transcript.ts`
- `src/harnesses/cursor/index.ts`
- `src/lib/transcript-render.ts`
- Codex `transcript.ts` as structural reference

## Input Dependencies

- Task 2 (adapter export surface)

## Output Artifacts

- Cursor JSONL parser and render path used by capture hooks and curate pipeline

## Implementation Notes

<details>
<summary>Guidance</summary>

- Cursor on-disk layout: `~/.cursor/projects/<project>/agent-transcripts/**/*.jsonl` ([plan clarifications](.ai/task-manager/plans/29--cursor-harness-plugin/plan-29--cursor-harness-plugin.md)).
- Parser is adapter-owned; do not change Claude JSONL field expectations.
- Keep parser pure; glob/discovery stays in Task 3 capture hook.

</details>
