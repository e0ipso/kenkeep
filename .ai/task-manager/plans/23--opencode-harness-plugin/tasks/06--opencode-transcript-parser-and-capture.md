---
id: 6
group: "opencode-adapter"
dependencies: [4]
status: "completed"
created: 2026-05-15
skills:
  - typescript
  - node
---

# Implement the OpenCode transcript parser and kb-capture hook script

## Objective

Parse OpenCode's on-disk session storage into the shared `RoleTaggedTranscript` shape and wire it into a `kb-capture.ts` hook script that the plugin shim invokes on `session.idle`. Implements the disk-parse-with-export-fallback strategy from the plan.

## Skills Required

- typescript
- node

## Acceptance Criteria

- [ ] `src/harnesses/opencode/transcript.ts` exports `parseOpenCodeTranscript(sessionDir: string, sessionID: string): RoleTaggedTranscript`
- [ ] Parser reads `${sessionDir}/session/<projectID>/<sessionID>.json`, then iterates `${sessionDir}/message/<sessionID>/*.json` files sorted by `time.created`, then for each message reads `${sessionDir}/part/<messageID>/*.json` and concatenates `part.text` for text parts
- [ ] Maps `message.role === 'user'` to `role: 'user'` and `message.role === 'assistant'` to `role: 'agent'`
- [ ] Returns `{ interleaved: [] }` when the session directory is missing OR all messages contain only non-text parts (tool calls)
- [ ] Locates the session dir at `${XDG_DATA_HOME:-$HOME/.local/share}/opencode/storage/` by default; the helper accepts an override path for testing
- [ ] `src/harnesses/opencode/hooks/kb-capture.ts` reads stdin, validates `session_id` and `cwd`, calls the parser, and feeds the result through the shared `captureSession()` pipeline used by Claude/Codex
- [ ] On parse returning zero turns OR session.json missing, capture script falls back to spawning `opencode export <sessionID>` (timeout-bounded at 30s) and passes its JSON output through an adapter into the same `RoleTaggedTranscript` shape
- [ ] Capture script always exits `0`; errors logged to stderr only
- [ ] Unit tests cover: a fixture session-dir with a multi-turn assistant+user thread parsed correctly; a session-dir with only tool-call parts returning empty interleaved; missing session.json triggering the fallback path (mock the `opencode export` spawn)
- [ ] `npm run build` succeeds and emits `templates/opencode/kb-hooks/kb-capture.mjs`
- [ ] `npm test` passes including the new fixtures

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/opencode/transcript.ts`
- `src/harnesses/opencode/hooks/kb-capture.ts`
- `execa` for the export fallback
- Existing `captureSession` shared pipeline
- Test fixture at `tests/fixtures/opencode-session/` with a hand-crafted session.json + message + part tree

## Input Dependencies

- Task 4 (adapter scaffold; placeholder `parseTranscript` gets filled in here)

## Output Artifacts

- Working transcript parser
- Working capture script that produces session logs identical in shape to Claude/Codex outputs

## Implementation Notes

<details>
<summary>Guidance</summary>

- The OpenCode session.json schema (verified against the plan's research): `{ id, projectID, time: { created, updated }, title?, ... }`. Each message file: `{ id, role: 'user'|'assistant', time: { created }, ... }`. Each part file: `{ id, type, text?, ... }`. We only care about `type === 'text'` parts.
- File enumeration order matters. Use `time.created` as the sort key, not filename, because partfile IDs are not necessarily monotonic.
- For the export fallback: `opencode export <sessionID> --format json` (verify exact flag in opencode docs; if no `--format` flag exists, the default output should still be parseable). Spawn with 30s timeout and `reject: false`. Adapt the JSON shape it returns into the same parser pipeline.
- Per the plan: "Exit 0 unconditionally so stalled lookups never block the plugin's event loop."
- Per `feedback_no_backwards_compat`: do not hardcode a fallback for an older storage layout; rely on the export fallback for any future reshape.

</details>
