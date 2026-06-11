---
id: 4
group: "usage-adapters"
dependencies: [2]
status: "completed"
created: 2026-06-11
skills:
  - typescript
---
# Codex read extractor (rollout function_call) + hook wiring

## Objective
Implement the read-extraction capability for the Codex adapter by scanning its
rollout JSONL for file-read tool calls, and wire the Codex capture hook to pass
the extracted read paths into the capture pipeline.

## Skills Required
`typescript` — JSONL parsing, adapter wiring.

## Acceptance Criteria
- [ ] The Codex extractor scans the rollout JSONL for `function_call`/tool-call items and returns the file path argument for read calls.
- [ ] The exact read-tool name and path argument key are confirmed against a real Codex rollout before relying on them (documented in the task if a live rollout is captured).
- [ ] `src/harnesses/codex/hooks/kk-capture.ts` passes the extracted read paths into `captureSession` via the Task 2 `CaptureContext`, alongside `nodesDir`/`kkDir`/`usageFile`.
- [ ] Malformed lines and non-read tool calls are ignored without throwing; empty result when no reads.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`src/harnesses/codex/transcript.ts` (shows the rollout shape: `response_item` with `payload.type`); `src/harnesses/codex/hooks/kk-capture.ts` (resolves the `rolloutPath`); the Task 2 contract/`CaptureContext`.

## Input Dependencies
Task 2 (contract + capture wiring shape).

## Output Artifacts
- Codex read extractor.
- Updated Codex capture hook passing read paths.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. **Shape.** Codex rollout lines are `{type, payload}`. Messages are `response_item`/`message` (handled by `parseCodexTranscript`). Tool calls are `response_item` items whose `payload.type` denotes a function/tool call (e.g. `function_call`), carrying the tool name and a JSON-encoded `arguments` string. **Confirm the precise `payload.type` and argument field against a real rollout** under `CODEX_HOME` (none was available on this machine during planning — high confidence but unverified).
2. **Extractor.** Split the rollout JSONL, `JSON.parse` each line (skip malformed). For each tool-call item, read the tool name; if it is the file-read tool, parse its `arguments` (which may be a JSON string) and pull the path field (likely `path` or `file_path` — confirm). Push non-empty path strings; preserve duplicates.
3. **Hook wiring.** In `src/harnesses/codex/hooks/kk-capture.ts`, the hook already resolves `rolloutPath` and passes it as `transcript_path`. Read that file, run the extractor to get `readPaths`, and pass `readPaths` + `repoPaths().nodesDir`/`kkDir`/`usageFile` into the `captureSession` context from Task 2.
4. Only the explicit file-read tool counts; ignore shell/search tool calls.
5. If the real rollout cannot be obtained, implement against the documented `function_call` shape and leave the extractor defensive (return `[]` on any unrecognized shape) so capture is never broken; note the open verification in this task file.
</details>
