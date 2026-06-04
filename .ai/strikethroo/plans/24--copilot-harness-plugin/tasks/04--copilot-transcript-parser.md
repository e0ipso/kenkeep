---
id: 4
group: "copilot-adapter"
dependencies: [2]
status: "completed"
created: 2026-05-15
skills:
  - typescript
---

# Implement the Copilot events.jsonl transcript parser

## Objective

Parse Copilot's on-disk `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl` stream into the shared `RoleTaggedTranscript` shape. The parser is the body of the `parseTranscript` placeholder declared in Task 2.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `src/harnesses/copilot/transcript.ts` exports `parseCopilotTranscript(eventsFile: string): RoleTaggedTranscript`
- [ ] Parser reads `eventsFile` line by line; each line is JSON-parsed. Lines that fail JSON.parse are skipped silently
- [ ] Selects events where `event.type === 'userMessage'` or `event.type === 'agentMessage'` AND falls back to scanning `event.data.role === 'user'` / `'assistant'` when the `type` field is absent or unrecognized
- [ ] For each selected event, concatenates `event.data.content` (or `event.data.text` if `content` is absent) into a single string per turn
- [ ] Returns `{ interleaved: [...] }` where entries are `{ role: 'user' | 'agent', content: string }` ordered by `event.timestamp` (ISO-8601 string compare is fine)
- [ ] Returns `{ interleaved: [] }` when the file is missing or no qualifying events are present
- [ ] Handles partial / truncated final lines by skipping them (no crash)
- [ ] The adapter's `parseTranscript` placeholder (from Task 2) is replaced with a call to `parseCopilotTranscript`
- [ ] Unit tests cover: (1) a multi-turn fixture with two user messages and two agent messages interleaved with one tool-call event (the tool-call is skipped); (2) a fixture where the agent emits the message as multiple chunks with the same `parentId` (verify concatenation); (3) a fixture with a truncated final JSON line; (4) a missing-file case
- [ ] `npm run build` succeeds
- [ ] `npm test` passes including the new fixtures

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/copilot/transcript.ts`
- `fs.promises` and `readline` (or `split2`) for line-by-line parsing
- Test fixture at `tests/fixtures/copilot-events/events.jsonl`

## Input Dependencies

- Task 2 (adapter scaffold; placeholder `parseTranscript` gets filled in here)

## Output Artifacts

- Working transcript parser ready for the capture script (Task 3 already imports `parseCopilotTranscript`)

## Implementation Notes

<details>
<summary>Guidance</summary>

- The Copilot events.jsonl envelope (per the plan's research) is `{ "type": "...", "data": {...}, "id": "uuid", "timestamp": "ISO-8601", "parentId": "uuid|null" }`. The exact `type` strings for user/agent messages are not pinned in public docs; the defensive scan covers both the documented `userMessage` / `agentMessage` names and the alternative `data.role` field.
- Concatenation rule: when multiple events share a `parentId` and a role (chunked streaming output), append their content strings in timestamp order and emit them as a single interleaved entry. Independent events (different `parentId`) become separate entries even if same role.
- When the file is missing: `fs.access(eventsFile)` failure returns `{ interleaved: [] }` without logging. The capture script handles "no transcript" by writing a session log with an empty `transcript_section`.
- Per the plan, the SQLite `session-store.db` is internal; do NOT depend on it. Only consume the JSONL file.
- Per `feedback_no_backwards_compat`: no fallback to a hypothetical older format; current Copilot CLI shape is the only target.

</details>
