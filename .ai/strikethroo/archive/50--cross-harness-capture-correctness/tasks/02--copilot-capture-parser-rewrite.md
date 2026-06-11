---
id: 2
group: "copilot-capture"
dependencies: []
status: "completed"
created: 2026-06-11
skills:
  - typescript
  - vitest
complexity_score: 6
complexity_notes: "Parser rewrite against a measured schema plus a real-shaped fixture and updates to every test that currently feeds invented Copilot shapes. Kept as one task because the parser and its tests must land together to leave the build green."
---
# Copilot Capture Parser Rewrite

## Objective
Rewrite `parseCopilotTranscript` to consume the **real** Copilot CLI v1.0.61
`events.jsonl` schema so capturing a Copilot session produces a non-empty,
role-tagged transcript with user and assistant turns in order. Replace the
invented `userMessage`/`agentMessage`/`data.role` test shapes with a
real-shaped fixture across every test that exercises Copilot parsing.

## Skills Required
- **typescript** — rewrite the parser against the measured schema.
- **vitest** — author the real-shaped fixture and update the parser/capture tests.

## Acceptance Criteria
- [ ] `parseCopilotTranscript` classifies `user.message` and `assistant.message`
      events, reads text from `data.content`, and no longer relies on
      `userMessage`/`agentMessage` type names or a `data.role` fallback (the real
      schema has no `data.role`).
- [ ] Turn grouping uses the real `turnId`/`parentId` semantics observed in a
      live session; chunked assistant output is concatenated into one turn and
      ordering matches the source `events.jsonl`.
- [ ] Parsing stays defensive: malformed/truncated lines are skipped, unknown
      event types are ignored, and a missing/empty file yields `{ interleaved: [] }`.
- [ ] A real-shaped fixture file (e.g. `tests/fixtures/copilot-transcript/events.jsonl`)
      exists and the parser test reads it (mirroring the Cursor fixture pattern).
- [ ] Every test currently feeding invented Copilot shapes is updated to the
      real schema: `tests/harnesses/transcript.test.ts`, `tests/hooks/kk-capture.test.ts`
      (the `writeCopilotEvents` helper), and `tests/harnesses/headless.test.ts`.
- [ ] A test asserts that an **invented-shape** input (old
      `userMessage`/`agentMessage`) now produces an empty transcript / fails the
      old expectations — proving the fixture reflects production.
- [ ] `npm test` passes and capture of the real-shaped fixture yields a
      non-empty `[USER]:`/`[AGENT]:` rendering.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript / Node 22+, ESM. Files in play (verified against the current tree):
  - `src/harnesses/copilot/transcript.ts:24-117` — `CopilotEvent`, `classify`,
    `messageText`, `parseCopilotTranscript`, `renderCopilotTranscript`.
  - `tests/harnesses/transcript.test.ts:67-87` (parametrized `copilot` case) and
    `:152-...` (copilot edge-case `describe`).
  - `tests/hooks/kk-capture.test.ts` — `writeCopilotEvents` (~line 141-170)
    emits invented shapes.
  - `tests/harnesses/headless.test.ts` — also references the invented shapes.
  - Cursor fixture precedent: `tests/fixtures/cursor-transcript/sample.jsonl`
    read at `tests/harnesses/transcript.test.ts:90-93`.
- Measured real schema (from the planning session, Copilot CLI **v1.0.61**):
  - Envelope per line: `{ type, data, id, timestamp, parentId }`.
  - User turn: `type: "user.message"`, text at `data.content`.
  - Assistant turn: `type: "assistant.message"`, text at `data.content`;
    assistant messages may also carry `data.toolRequests`.
  - **No `data.role` field** on message events.
  - Turn structure: `assistant.turn_start` / `assistant.turn_end`,
    `session.*`, `hook.*`, `system.message`, and tool events
    `tool.execution_start` (with `data.toolName`/`data.arguments`, e.g.
    `toolName:"view"`, `arguments.path`). Tool events are **not required** here
    (they belong to plan 49) — the parser should ignore them gracefully.

## Input Dependencies
None. Independent of Task 1 — it touches the transcript parser and copilot
fixtures only, not the capture entry point or trigger mapping.

## Output Artifacts
- A corrected `parseCopilotTranscript` that produces non-empty transcripts from
  real Copilot sessions.
- A real-shaped `events.jsonl` fixture under `tests/fixtures/`.
- Updated Copilot tests (parser, capture integration, headless) keyed to the
  real schema, including a regression assertion that invented shapes no longer
  parse.

## Implementation Notes

> **Measured, not inferred.** The current parser keys on `userMessage`/
> `agentMessage` and a `data.role` fallback; against a real v1.0.61
> `events.jsonl` every event classifies as `null` and the captured transcript is
> **empty**. The fix is correctness-only — no backwards compatibility to
> preserve (already-captured empty logs are not retroactively repaired, per the
> plan's Notes).

> **Test philosophy — "write a few tests, mostly integration."** Meaningful tests
> verify custom business logic, critical paths, and edge cases specific to this
> application. Test *your* code, not the framework. WRITE tests for: custom
> business logic and algorithms; critical workflows and data transformations;
> edge cases and error conditions for core functionality; integration points;
> complex validation/calculations. DO NOT write tests for: third-party library
> functionality; framework features; simple CRUD without custom logic; trivial
> getters/setters or static config; obvious functionality that would break
> immediately if wrong. Combine related scenarios into a single task; favor
> integration and critical-path coverage. The Copilot parser is custom parsing
> logic over a measured schema — cover the happy path (multi-turn ordering),
> chunked-output concatenation, and the malformed/empty-line edge cases in the
> existing edge-case `describe`; do not add a separate test per event type.

<details>
<summary>Executable guidance</summary>

**1. Rewrite `classify` and the event interface** in
`src/harnesses/copilot/transcript.ts`:
- `CopilotEvent.type` of interest: `'user.message'` → `'user'`,
  `'assistant.message'` → `'agent'`; everything else → `null` (ignored).
- Remove the `data.role` branch and the `userMessage`/`agentMessage` names.
- `messageText` still reads `data.content` (string). Drop the `data.text`
  fallback unless you confirm it exists in the measured schema; the measured
  schema puts text at `data.content`.

**2. Turn grouping.** Keep concatenating consecutive same-role chunks that share
a grouping key. Prefer a `turnId` if present on the envelope/`data`; otherwise
fall back to `parentId` as today. Preserve the existing stable sort (timestamp,
then stream order) so equal/missing timestamps keep source order. Keep the
defensive `try/catch` per line and the empty/missing-file behavior.

**3. Author the real-shaped fixture** at
`tests/fixtures/copilot-transcript/events.jsonl`. Build it from the measured
schema — one JSON object per line, e.g.:
```
{"type":"session.start","data":{},"id":"s1","timestamp":"2026-06-05T00:00:00Z","parentId":null}
{"type":"user.message","data":{"content":"How do I run tests?"},"id":"u1","timestamp":"2026-06-05T00:00:01Z","parentId":null}
{"type":"assistant.turn_start","data":{},"id":"t1","timestamp":"2026-06-05T00:00:02Z","parentId":"u1"}
{"type":"assistant.message","data":{"content":"Run npm test "},"id":"a1","timestamp":"2026-06-05T00:00:03Z","parentId":"t1"}
{"type":"assistant.message","data":{"content":"from the repo root."},"id":"a2","timestamp":"2026-06-05T00:00:04Z","parentId":"t1"}
{"type":"tool.execution_start","data":{"toolName":"view","arguments":{"path":"README.md"}},"id":"x1","timestamp":"2026-06-05T00:00:05Z","parentId":"t1"}
{"type":"assistant.turn_end","data":{},"id":"t1e","timestamp":"2026-06-05T00:00:06Z","parentId":"t1"}
```
Expected parse: `[{role:'user',text:'How do I run tests?'},{role:'agent',text:'Run npm test \nfrom the repo root.'}]`
(the tool event is ignored; the two assistant chunks concatenate). Adjust the
concatenation join to match the parser's behavior.

**4. Update the tests:**
- `tests/harnesses/transcript.test.ts` — change the parametrized `copilot` case
  to read the fixture file (mirror the `cursor` case at lines 88-98) and update
  the edge-case `describe` to real shapes (`user.message`/`assistant.message`,
  a chunked assistant turn sharing a grouping key, and a truncated final line).
- `tests/hooks/kk-capture.test.ts` — rewrite `writeCopilotEvents` to emit real
  shapes so the integration test captures a non-empty transcript. The
  `captured_by` assertions there are Task 1's concern and must remain green; do
  not change the asserted trigger values.
- `tests/harnesses/headless.test.ts` — replace any invented Copilot shapes with
  real ones.
- Add a focused regression test: feed an old invented-shape line
  (`{"type":"userMessage",...}`) and assert `interleaved` is empty.

**5. Verify the sweep.** `grep -rn "userMessage\|agentMessage" src/ tests/`
must return nothing after this task. Run `npm test`.
</details>
