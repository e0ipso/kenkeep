---
id: 3
group: "opencode-capture"
dependencies: [1, 2]
status: "completed"
created: 2026-06-11
skills:
  - typescript
complexity_score: 6
complexity_notes: "One cohesive rewrite spanning the capture hook, the transcript module (file-tree removal), and a deadline change; must land atomically or capture is left with no transcript source."
---
# Rewrite the OpenCode capture hook to be export-primary

## Objective
Make `opencode export` the sole transcript and usage source for OpenCode capture:
normalize the session id, source the transcript and read paths from the export
JSON, raise the capture deadline to fit export latency, and remove the dead
file-tree storage path.

## Skills Required
`typescript` — subprocess handling, capture pipeline wiring.

## Acceptance Criteria
- [ ] `src/harnesses/opencode/hooks/kk-capture.ts` applies `normalizeOpenCodeSessionId` (Task 2) to the incoming `session_id` before `assertValidSessionId`.
- [ ] The hook runs `opencode export <sessionId>` as the **primary** source (not a fallback), parses the JSON once, shapes the transcript via the existing `shapeExportedTranscript`, and extracts read paths via the Task 1 extractor — passing them as `usage.readPaths` to `captureSession`.
- [ ] The file-tree path is removed: `parseOpenCodeTranscript` and `defaultOpenCodeStorageDir` are deleted from `src/harnesses/opencode/transcript.ts`, and the hook no longer imports/uses them; `src/harnesses/opencode/index.ts` still compiles (its `parseOpenCodeTranscriptText`/`renderOpenCodeTranscript` stubs are unaffected).
- [ ] The hook's hard deadline is raised from `1000` ms to a value comfortably above measured export latency (1.4–3.0s), with a comment citing the measurement. Other adapters are untouched.
- [ ] The existing `opencode --version` guard and the export subprocess timeout are retained; export failure exits silently (no crash).
- [ ] `tests/harnesses/transcript.test.ts` is updated to drop the removed `parseOpenCodeTranscript` assertions; the full suite stays green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`src/harnesses/opencode/hooks/kk-capture.ts` (has `exportFallback()` + `shapeExportedTranscript()` to promote); `src/harnesses/opencode/transcript.ts` (remove file-tree exports); `src/harnesses/opencode/index.ts`; `src/lib/session-log.js` (`assertValidSessionId`); the Task 1 extractor and Task 2 normalizer; `tests/harnesses/transcript.test.ts`.

## Input Dependencies
Task 1 (export read extractor), Task 2 (session-id normalizer).

## Output Artifacts
- Export-primary OpenCode capture hook; file-tree functions removed; deadline raised.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. **Normalize id.** In `kk-capture.ts`, before `assertValidSessionId(payload['session_id'])`, run the raw id through `normalizeOpenCodeSessionId` (Task 2). The plugin passes `event.properties.sessionID` (`plugins/kk.ts:40`), which is `ses_...`.
2. **Export as primary.** Reuse the existing `exportFallback` spawn logic (`opencode --version` guard, `spawnSync('opencode', ['export', sessionId], { timeout: EXPORT_TIMEOUT_MS })`) but call it unconditionally as the source. Parse stdout once into `exportJson`. If export is unavailable/empty, exit silently (current behavior).
3. **Transcript.** Shape `exportJson` into the role-tagged transcript with the existing `shapeExportedTranscript` (it already reads `messages[].parts[]` text parts). Write it to the temp file and call `captureSession` with `parseTranscript = JSON.parse` (existing pattern).
4. **Usage.** Compute `readPaths = extractOpenCodeReads(exportJson)` (Task 1) and pass `usage: { nodesDir, kkDir, usageFile, readPaths }` to `captureSession` (the `usage` field already exists on `CaptureContext`). OpenCode uses precomputed `readPaths`, not `extractReads`.
5. **Remove file-tree code.** Delete `parseOpenCodeTranscript` and `defaultOpenCodeStorageDir` from `transcript.ts`; remove their imports/usages from the hook. Confirm `index.ts` does not import them (it uses `parseOpenCodeTranscriptText`/`renderOpenCodeTranscript`, which stay).
6. **Deadline.** Raise `HARD_DEADLINE_MS` in this hook to e.g. `8000` with a comment: measured `opencode export` latency 1.4–3.0s exceeds 1s; safe because `plugins/kk.ts` spawns the capture child without awaiting it.
7. **Tests.** In `tests/harnesses/transcript.test.ts`, remove the two `parseOpenCodeTranscript(...)` assertions (function gone). Do not add new export-shape tests here — the extractor/normalizer are covered by Tasks 1–2 and the end-to-end is in the plan's Self Validation.
8. Keep the change OpenCode-local; do not touch shared `capture.ts`, other adapters, or the usage ledger.
</details>
