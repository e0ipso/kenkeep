---
id: 2
group: "cursor-adapter"
dependencies: [1]
status: "completed"
created: "2026-05-21"
skills:
  - typescript
---
# Scaffold Cursor harness adapter, registry, and ModelChoiceSchema

## Objective

Create the Cursor adapter shell mirroring Codex: module export, registry entry, `paths(root)`, opts schema, install skeleton, `detectFromEnv`, and doctor stubs. Wire `ModelChoiceSchema` with a `{ harness: 'cursor', model: string }` variant. `runHeadless`, `parseTranscript`, hook writer bodies, and hook scripts are placeholders filled by later tasks.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `src/harnesses/cursor/index.ts` exports `cursorAdapter: HarnessAdapter` with `id: 'cursor'`
- [ ] `detectFromEnv`: true when `typeof env.CURSOR_VERSION === 'string' && env.CURSOR_VERSION.length > 0 && env.CLAUDECODE !== '1'`
- [ ] `src/harnesses/registry.ts` registers `cursorAdapter`; `listHarnessIds()` returns `['claude', 'codex', 'cursor', 'opencode']` (sorted)
- [ ] `paths(root)` returns `{ dir: join(root, '.cursor'), skillsDir: join(root, '.cursor', 'skills'), hooksDir: join(root, '.cursor', 'hooks'), settingsFile: join(root, '.cursor', 'hooks.json') }`
- [ ] `opts.ts` exports `CursorHarnessOptsSchema` (Zod): minimum `{ model?: string, agentCli?: string }` for headless/doctor overrides in tests
- [ ] `hook-spec.ts` declares native camelCase events: `stop`, `sessionEnd`, `preCompact`, `sessionStart` with script paths under `.cursor/hooks/kb-*.cjs` (no PascalCase translation)
- [ ] `hooks-config.ts` exports `writeCursorHooksConfig(paths)` stub (throws or no-op until Task 3)
- [ ] `install.ts` / `upgrade()` call `installSharedSkills` into `.cursor/skills/` and copy template hooks; delegate JSON write to `writeCursorHooksConfig`
- [ ] `listMemoryFiles` returns `[]` without spawning children
- [ ] `src/lib/schemas.ts` adds `CursorModelChoiceSchema` and includes it in `ModelChoiceSchema` discriminated union
- [ ] `doctor.ts` skeleton lists checks (agent CLI, hooks.json, hook scripts, skills) with warn/error placeholders until Tasks 3–5 fill artifacts
- [ ] `runHeadless`, `parseTranscript`, `renderTranscript` throw `not implemented` until Tasks 4–5
- [ ] `npm run build` succeeds; registry test asserts `getHarness('cursor')`; `npm test` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/cursor/{index,install,hook-spec,hooks-config,doctor,opts,transcript,headless}.ts`
- `src/harnesses/registry.ts`
- `src/lib/schemas.ts`
- Codex adapter (`src/harnesses/codex/`) as the primary reference for shell-hook shape

## Input Dependencies

- Task 1 (Claude detection tightened; SKILL heredocs list `cursor`)

## Output Artifacts

- Registered `cursor` harness id accepted by `init --harnesses cursor`
- Cursor paths, opts schema, hook-spec entries, install skeleton

## Implementation Notes

<details>
<summary>Guidance</summary>

- Follow [map-harness-adapter](.ai/knowledge-base/nodes/map/map-harness-adapter.md): adapters never cross directories; shared logic stays in `src/lib/`.
- `HookEvent` stays opaque string; register native Cursor names only (`stop`, not `Stop`).
- tsup/build-templates must emit `templates/cursor/hooks/kb-*.cjs` from `src/harnesses/cursor/hooks/` sources (mirror Codex pipeline; no OpenCode `pluginsDir` / `kb-hooks` rename unless build already requires it).
- Do **not** add `pluginsDir` to Cursor paths.
- Session-id normalization for non-UUID `conversation_id` is deferred to Task 3 at the hook boundary if needed after inspecting a real id format.

</details>
