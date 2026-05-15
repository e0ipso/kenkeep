---
id: 4
group: "opencode-adapter"
dependencies: [1, 2]
status: "completed"
created: 2026-05-15
skills:
  - typescript
---

# Scaffold the OpenCode harness adapter module and register it

## Objective

Create the OpenCode adapter shell mirroring Claude/Codex: module export, registry entry, `paths(root)`, hook spec, opts schema, install entry that copies plugin + kb-hooks templates (no JSON/TOML config writing because the plugin file is self-registering), and doctor checks. The CLI's `init --harnesses opencode` validator must accept the new id.

`runHeadless` and the transcript pipeline may throw `not implemented` here; they land in Tasks 6 and 7. The plugin shim TS source and per-event Node script sources land in Task 5. The skill copy step is owned by Task 8's shared-skills installer.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `src/harnesses/opencode/index.ts` exports `opencodeAdapter: HarnessAdapter` with `id: 'opencode'`
- [ ] `src/harnesses/registry.ts` registers `opencodeAdapter` alongside the Claude and Codex adapters
- [ ] `paths(root)` returns `{ dir: '.opencode', pluginsDir: '.opencode/plugins', skillsDir: '.opencode/skills' }`. `hooksDir`, `commandsDir`, `settingsFile` are omitted
- [ ] `hook-spec.ts` declares two events using OpenCode-native names: `session.idle` (with `kb-capture.mjs` and `kb-lint-tick.mjs`) and `session.created` (with `kb-session-start.mjs` and `kb-proposal-drain.mjs` marked `async: true`)
- [ ] `opts.ts` exports `OpenCodeHarnessOptsSchema` (Zod): `{ model: string, agent?: string }`. The `model` is a `<provider>/<model>` string passed verbatim to `opencode run --model`
- [ ] `install()` copies `templates/opencode/plugins/kb.mjs` to `.opencode/plugins/kb.mjs` and `templates/opencode/kb-hooks/*.mjs` to `.opencode/kb-hooks/`. Skills install is delegated to the shared-skill installer (Task 8)
- [ ] `upgrade()` is idempotent and overwrites the same set
- [ ] `doctorChecks(paths)` runs: (1) `opencode --version` on PATH (error if ENOENT), (2) `.opencode/plugins/kb.mjs` exists and contains the package marker comment, (3) `.opencode/kb-hooks/kb-{capture,session-start,proposal-drain,lint-tick}.mjs` all exist, (4) shared skills installed at `.opencode/skills/kb-{add,bootstrap,curate}/SKILL.md` (the check looks for the canonical files, which Task 8's installer puts in place)
- [ ] `detectFromEnv` is NOT implemented (returns `undefined`). The plan explicitly disallows this; selection happens via `--hint` or `cliDefaultHarness`
- [ ] CLI `init` accepts `--harnesses opencode` (extend the validator if it has a hardcoded list)
- [ ] `runHeadless`, `parseTranscript`, `renderTranscript` throw `not implemented` placeholders (filled by Tasks 6 and 7)
- [ ] `npm run build` succeeds; `npm test` passes; registry-level test asserts `getHarness('opencode')` returns the adapter

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/opencode/{index,install,hook-spec,doctor,opts}.ts`
- Uses `HarnessPaths.pluginsDir` (Task 1) and the new build pipeline (Task 2)
- `execa` for `opencode --version`
- `zod` for the opts schema

## Input Dependencies

- Task 1 (HookEvent opaque string + `HarnessPaths.pluginsDir`)
- Task 2 (tsup discovers `plugins/` and emits `kb-hooks/` for OpenCode)

## Output Artifacts

- Working OpenCode adapter scaffold registered in the global registry
- Doctor checks, paths, hook spec, opts schema, install skeleton

## Implementation Notes

<details>
<summary>Guidance</summary>

- Package marker comment: emit a leading `// @e0ipso/ai-knowledge-base opencode plugin` comment in `plugins/kb.ts` (Task 5) so doctor can grep for it.
- Hook spec entries (using OpenCode event-bus names directly):
  ```ts
  export const opencodeHookSpecs: HookSpec[] = [
    { event: 'session.idle', scriptPath: 'kb-capture.mjs' },
    { event: 'session.idle', scriptPath: 'kb-lint-tick.mjs' },
    { event: 'session.created', scriptPath: 'kb-session-start.mjs' },
    { event: 'session.created', scriptPath: 'kb-proposal-drain.mjs', async: true },
  ];
  ```
- Doctor `opencode --version`: use `execa` with `reject: false`. Treat ENOENT as a failed error-level check pointing the user at `https://opencode.ai/docs/cli/installation`.
- `install()` reads from `packageTemplatesDir()/opencode/`. The plugin lives at `templates/opencode/plugins/kb.mjs`; the per-event scripts live at `templates/opencode/kb-hooks/*.mjs`. Per Task 2's rename convention, the build emits `kb-hooks/` (not `hooks/`) for adapters that have a `plugins/` dir to avoid colliding with the OpenCode runtime's reserved `.opencode/hooks/`.
- Skill copy: do NOT copy skills here. Task 8's shared-skills installer handles `.opencode/skills/` for every configured harness in one place.
- Per `feedback_no_backwards_compat`: no fallback to a legacy plugin location; `.opencode/plugins/kb.mjs` is canonical.

</details>
