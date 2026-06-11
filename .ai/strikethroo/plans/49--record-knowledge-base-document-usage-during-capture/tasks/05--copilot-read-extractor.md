---
id: 5
group: "usage-adapters"
dependencies: [2]
status: "completed"
created: 2026-06-11
skills:
  - typescript
---
# Copilot read extractor (events.jsonl tool.execution_start) + hook wiring

## Objective
Implement the read-extraction capability for the Copilot adapter by scanning its
`events.jsonl` for `tool.execution_start` events that read files, and wire the
Copilot capture hook to pass the extracted read paths into the capture pipeline.

## Skills Required
`typescript` — JSONL event parsing, adapter wiring.

## Acceptance Criteria
- [ ] The Copilot extractor scans `events.jsonl` for `tool.execution_start` events and returns `data.arguments.path` for read events (`data.toolName === 'view'`), using the `data`-wrapped envelope.
- [ ] The extractor targets the real `tool.execution_start` type — NOT the invented `toolCall` string in the current test fixture.
- [ ] A small known read-tool set is matched (default `view`) so the matcher is not brittle to a single hardcoded string; the matched set is documented.
- [ ] `src/harnesses/copilot/hooks/kk-capture.ts` passes the extracted read paths into `captureSession` via the Task 2 `CaptureContext`, alongside `nodesDir`/`kkDir`/`usageFile`.
- [ ] Malformed lines and non-read events are ignored without throwing; empty result when no reads.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`src/harnesses/copilot/hooks/kk-capture.ts` (resolves `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/events.jsonl`); the Task 2 contract/`CaptureContext`. Measured ground truth from a real CLI v1.0.61 session is in the plan Background.

## Input Dependencies
Task 2 (contract + capture wiring shape).

## Output Artifacts
- Copilot read extractor.
- Updated Copilot capture hook passing read paths.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. **Measured shape (CLI v1.0.61).** Each `events.jsonl` line is `{type, data, id, timestamp, parentId}`. A file read is:
   `{"type":"tool.execution_start","data":{"toolCallId":"…","toolName":"view","arguments":{"path":"/abs/file"},"model":"…","turnId":"0"}}`.
   So: filter `.type === 'tool.execution_start'`; if `.data.toolName` is in the read-tool set (default `{'view'}`), push `.data.arguments.path` when it is a non-empty string. Preserve duplicates.
2. **Do NOT use the current fixture's shape.** The existing parser/fixture invents `toolCall`/`userMessage`/`agentMessage`; those do not exist in the real schema. Use `tool.execution_start` and the `data`-wrapped envelope.
3. **Hook wiring.** In `src/harnesses/copilot/hooks/kk-capture.ts`, the hook already computes the `events.jsonl` path (`eventsFile`). Read it, run the extractor to get `readPaths`, and pass `readPaths` + `repoPaths().nodesDir`/`kkDir`/`usageFile` into the `captureSession` context from Task 2.
4. **Version sensitivity.** `view` is the read tool for this build/model; keep the matched read-tool set small and centralized so it is easy to extend. Return `[]` on any unrecognized shape so capture is never broken.
5. **Coordination (soft).** Plan 50 rewrites the Copilot message parser against the same `events.jsonl` real schema. If plan 50 lands first, reuse its shared Copilot events reader rather than re-parsing the file here. This task does not depend on the message parser (it reads `tool.execution_start` directly), so it is not blocked.
</details>
