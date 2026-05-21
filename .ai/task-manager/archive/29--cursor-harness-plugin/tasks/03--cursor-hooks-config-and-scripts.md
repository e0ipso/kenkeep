---
id: 3
group: "cursor-adapter"
dependencies: [2]
status: "completed"
created: "2026-05-21"
skills:
  - typescript
  - node
---
# Implement Cursor hooks.json writer and per-event hook scripts

## Objective

Fill in `writeCursorHooksConfig` to merge owned `.cursor/hooks/kb-*` entries into `.cursor/hooks.json` (Codex-style owned-prefix replacement), and author the four hook scripts that normalize Cursor stdin/stdout at the adapter boundary while delegating to shared `lib/` helpers.

## Skills Required

- typescript
- node

## Acceptance Criteria

- [ ] `writeCursorHooksConfig` writes `{ "version": 1, "hooks": { ... } }` with commands `node .cursor/hooks/kb-*.cjs`, timeouts 30s, events: `stop`, `sessionEnd` (capture + lint-tick), `preCompact`, `sessionStart` (session-start + proposal-drain) per plan JSON shape
- [ ] Merge preserves user hooks whose `command` does not include `.cursor/hooks/kb-`; owned kb commands are replaced on upgrade
- [ ] Hook sources at `src/harnesses/cursor/hooks/{kb-capture,kb-session-start,kb-proposal-drain,kb-lint-tick}.ts` compile to `templates/cursor/hooks/kb-*.cjs`
- [ ] All scripts: early exit when `KB_BUILDER_INTERNAL === '1'`; silent exit 0 when `.ai/knowledge-base/` missing; errors logged to stderr, never block Cursor (exit 0)
- [ ] `kb-capture`: map `conversation_id` → `session_id`; use `transcript_path` from stdin or `CURSOR_TRANSCRIPT_PATH`; honor `hook_event_name` for `stop` / `sessionEnd` / `preCompact`; call `captureSession()` with Cursor `parseTranscript` (Task 4 wires parser; import and bind here)
- [ ] `kb-session-start`: `buildSessionStartContext()`; stdout `{ "additional_context": "<payload>" }` (native Cursor envelope, not Claude `hookSpecificOutput`)
- [ ] `kb-proposal-drain` / `kb-lint-tick`: mirror Codex/Claude behavior with Cursor stdin normalization only where needed
- [ ] Transcript fallback when path null: glob `~/.cursor/projects/*/agent-transcripts/**/*<conversation_id>*.jsonl`, newest wins; silent no-op when none (existing capture pattern)
- [ ] If `conversation_id` is not UUID v4, normalize at hook boundary (e.g. deterministic UUID v5) without weakening Claude/Codex validators
- [ ] Unit tests: hooks.json merge determinism; capture smoke with fixture stdin + fixture JSONL; session-start stdout shape
- [ ] `npm run build` emits templates; `npm test` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/cursor/hooks-config.ts`
- `src/harnesses/cursor/hooks/*.ts`
- Shared: `lib/capture`, `lib/session-start`, `lib/proposal-drain`, lint-tick helpers
- Codex `hooks-config.ts` and hook scripts as reference
- Fixtures under `tests/fixtures/cursor-*` as needed

## Input Dependencies

- Task 2 (adapter scaffold, hook-spec, install copies templates)

## Output Artifacts

- Working `.cursor/hooks.json` writer
- Four compiled hook scripts with Cursor field normalization

## Implementation Notes

<details>
<summary>Guidance</summary>

- Official Cursor hook reference: camelCase keys, common stdin fields `conversation_id`, `transcript_path`, `hook_event_name` ([Hooks](https://cursor.com/docs/hooks)).
- `sessionStart` may be fire-and-forget; still implement stdout per native schema. If self-validation shows unreliable injection, note for Task 7 docs only (AGENTS.md fallback).
- Do not translate event names to Claude PascalCase in config or scripts.
- Set `KB_BUILDER_INTERNAL=1` on any child spawns from shared code paths (recursion guard).
- Capture runs secretlint via existing pipeline; do not bypass.

</details>
