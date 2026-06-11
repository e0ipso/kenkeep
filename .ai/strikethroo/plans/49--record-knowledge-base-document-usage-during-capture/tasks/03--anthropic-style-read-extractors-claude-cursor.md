---
id: 3
group: "usage-adapters"
dependencies: [2]
status: "completed"
created: 2026-06-11
skills:
  - typescript
---
# Claude + Cursor read extractors (Anthropic-style tool_use) + hook wiring

## Objective
Implement the read-extraction capability for the two harnesses whose raw
transcript uses Anthropic-style `tool_use` content blocks — Claude and Cursor —
with a shared helper, and wire each adapter's capture hook to pass the extracted
read paths into the capture pipeline.

## Skills Required
`typescript` — JSON/JSONL parsing, adapter wiring.

## Acceptance Criteria
- [ ] A shared helper extracts read file paths from Anthropic-style `tool_use` blocks in a raw transcript, parameterized by the read tool name and the path key.
- [ ] **Claude**: extracts paths from `tool_use` blocks where `name === 'Read'`, path at `input.file_path`, over the raw Claude JSONL (`transcript_path`).
- [ ] **Cursor**: extracts paths from `message.content[]` `tool_use` blocks where `name === 'ReadFile'`, path at `input.path`, over the real Cursor transcript JSONL.
- [ ] `src/harnesses/claude/hooks/kk-capture.ts` and `src/harnesses/cursor/hooks/kk-capture.ts` pass the extracted read paths into `captureSession` via the Task 2 `CaptureContext`, alongside `nodesDir`/`kkDir`/`usageFile`.
- [ ] Malformed/non-read blocks and non-`tool_use` content are ignored without throwing; an empty result is returned when no reads are present.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`src/harnesses/claude/transcript.ts` and `src/harnesses/cursor/transcript.ts` (existing parsers show the raw shapes); the two `hooks/kk-capture.ts` files; the Task 2 contract/`CaptureContext`; `repoPaths()`.

## Input Dependencies
Task 2 (contract + capture wiring shape).

## Output Artifacts
- Shared Anthropic-style read extractor + Claude and Cursor implementations.
- Updated Claude and Cursor capture hooks passing read paths.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. **Shared helper.** Add a helper (e.g. in `src/lib/usage.ts` or a small `src/harnesses/<shared>` util) `extractAnthropicToolReads(rawJsonl, { toolName, pathKey })`: split the raw JSONL by line, `JSON.parse` each (skip malformed), and for each message collect `content[]` (or `message.content[]`) blocks where `type === 'tool_use'` and `name === toolName`; push `input[pathKey]` when it is a non-empty string. Return the array of paths (duplicates preserved — multiple reads count multiple times, per the plan).
2. **Claude.** In `src/harnesses/claude/...`, implement the adapter capability by calling the helper with `{ toolName: 'Read', pathKey: 'file_path' }` over the raw transcript text (the same text `parseTranscriptJsonl` consumes). Verified shape: assistant messages carry `content[]` blocks `{type:'tool_use', name:'Read', input:{file_path}}`.
3. **Cursor.** In `src/harnesses/cursor/...`, call the helper with `{ toolName: 'ReadFile', pathKey: 'path' }`. Verified from a real on-disk transcript: blocks are `message.content[]` `{type:'tool_use', name:'ReadFile', input:{limit,offset,path}}`. Account for the nesting under `.message.content` (Cursor) vs top-level `.content`/`message.content` (Claude) — the helper should look at both `content` and `message.content`.
4. **Hook wiring.** In each `hooks/kk-capture.ts`, after locating the raw transcript (Claude: `transcript_path`; Cursor: the resolved `agent-transcripts/<id>.jsonl`), read it, run the extractor to get `readPaths`, and pass `readPaths` + `repoPaths().nodesDir`/`kkDir`/`usageFile` into the `captureSession` context fields from Task 2. Keep this additive — do not change existing transcript parsing/capture behavior.
5. Only `Read`/`ReadFile` count (explicit file opens); ignore `rg`, `Shell`, `Grep`, etc.
</details>
