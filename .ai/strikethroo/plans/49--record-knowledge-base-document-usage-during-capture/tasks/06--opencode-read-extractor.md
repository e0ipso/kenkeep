---
id: 6
group: "usage-adapters"
dependencies: [2]
status: "completed"
created: 2026-06-11
skills:
  - typescript
---
# OpenCode read extractor (storage part-tree + export) + hook wiring

## Objective
Implement the read-extraction capability for the OpenCode adapter by reading
file-read tool-call parts from its on-disk storage `part/` tree (and the
`opencode export` fallback) **in the hook, before** the transcript is reduced to
role-tagged text, then pass the extracted read paths into the capture pipeline.

## Skills Required
`typescript` — filesystem traversal, JSON parsing, adapter wiring.

## Acceptance Criteria
- [ ] The OpenCode extractor reads tool-call parts (the parts the role-tagged parser currently discards) from the storage `part/<messageID>/` tree for the session and returns the file path for read calls.
- [ ] The `opencode export` fallback path is handled consistently (same extraction applied to the exported message/parts shape) when the on-disk parse yields nothing.
- [ ] `src/harnesses/opencode/hooks/kk-capture.ts` computes read paths from the native storage tree **before** it writes the role-tagged temp JSON, and passes them into `captureSession` via the Task 2 `CaptureContext`, alongside `nodesDir`/`kkDir`/`usageFile`.
- [ ] Malformed/non-read parts are ignored without throwing; empty result when no reads.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`src/harnesses/opencode/transcript.ts` (`defaultOpenCodeStorageDir`, `parseOpenCodeTranscript`, the `message/<sessionID>/` + `part/<messageID>/` layout); `src/harnesses/opencode/hooks/kk-capture.ts` (note it parses storage then writes role-tagged text to a temp file and calls `captureSession` with `parseTranscript = JSON.parse` — the raw tool data is gone after that point); the Task 2 contract/`CaptureContext`.

## Input Dependencies
Task 2 (contract + capture wiring shape).

## Output Artifacts
- OpenCode read extractor over the storage part-tree (+ export fallback).
- Updated OpenCode capture hook computing and passing read paths from the native source.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. **Why the hook, not captureSession.** OpenCode's hook (`opencode/hooks/kk-capture.ts:57-79`) parses storage into a role-tagged transcript, writes it as JSON to a temp file, and calls `captureSession` with `parseTranscript = JSON.parse`. By then tool-call data is gone. So extraction MUST happen in the hook against the storage tree, before that reduction.
2. **Part shapes.** Parts live at `<storageDir>/part/<messageID>/<partID>.json`. The role-tagged parser keeps only `type === 'text'` parts; tool-call parts have a different `type` (e.g. a tool/tool-call part carrying the tool name and arguments). Inspect the real part JSON to confirm the tool-call part `type` and where the read tool's path argument lives, then extract the path for read-tool parts.
3. **Extractor.** Walk the message tree for the session (same iteration as `parseOpenCodeTranscript`), but instead of text parts, collect read-tool parts and push their path argument. Preserve duplicates.
4. **Export fallback.** When `parseOpenCodeTranscript` yields zero turns and the hook falls back to `opencode export`, apply the same extraction to the exported `messages[].parts[]` shape so usage is captured on that path too.
5. **Hook wiring.** Compute `readPaths` from the storage tree (and/or export result) and pass `readPaths` + `repoPaths().nodesDir`/`kkDir`/`usageFile` into the `captureSession` context from Task 2. Keep the existing text-capture behavior unchanged.
6. Only the explicit file-read tool counts; ignore shell/search/edit parts. Return `[]` on any unrecognized shape so capture is never broken.
</details>
