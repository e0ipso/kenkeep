---
id: 2
group: "copilot-adapter"
dependencies: [1]
status: "completed"
created: 2026-05-15
skills:
  - typescript
---

# Scaffold the Copilot harness adapter module and register it

## Objective

Create the Copilot adapter shell mirroring the Codex and OpenCode adapters: module export, registry entry, `paths(root)`, opts schema, install entry skeleton, and doctor checks. `runHeadless`, `parseTranscript`, and `renderTranscript` are placeholder slots filled by later tasks. `hook-spec.ts` and `hooks-config.ts` skeletons land here too but the per-event Node script sources and the actual JSON writer body land in Task 3. The CLI's `init --harnesses copilot` validator must accept the new id.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `src/harnesses/copilot/index.ts` exports `copilotAdapter: HarnessAdapter` with `id: 'copilot'`
- [ ] `src/harnesses/registry.ts` registers `copilotAdapter` alongside the existing three adapters
- [ ] `listHarnessIds()` returns `['claude', 'codex', 'copilot', 'opencode']` (sorted)
- [ ] `paths(root)` returns `{ dir: <root>/.copilot, hooksDir: <root>/.copilot/hooks, skillsDir: <root>/.github/skills, settingsFile: ~/.copilot/hooks/kb.json }` (HOME expanded with `os.homedir()`)
- [ ] `opts.ts` exports `CopilotHarnessOptsSchema` (Zod): `{ model?: string }` only. No effort knob. Model is an opaque string passed verbatim to `copilot --model`
- [ ] `install()` calls `installSharedSkills(opts.templatesDir, paths.skillsDir)` (which copies the shared SKILL.md tree into `.github/skills/`); copies `templates/copilot/kb-hooks/*.mjs` to `<root>/.copilot/kb-hooks/`; delegates the hook JSON writing to `writeCopilotHookConfig(paths)` (the helper body is empty in this task and filled in Task 3); delegates the `.github/copilot-instructions.md` sentinel write to `writeCopilotInstructionsSentinel(paths)` (also a stub in this task, filled in Task 3)
- [ ] `upgrade()` is idempotent and overwrites the same set
- [ ] `doctorChecks(paths)` runs (with checks that depend on Tasks 3, 4, 5 returning warnings rather than errors when their artifacts are absent): (1) `copilot --version` resolves on PATH (error if ENOENT); (2) one of `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` is set OR `~/.copilot/settings.json` exists (warn-level when ambiguous); (3) `~/.copilot/hooks/kb.json` exists and parses (error); (4) `.copilot/kb-hooks/kb-{capture,session-start,proposal-drain,lint-tick}.mjs` all exist (error); (5) `.github/skills/kb-{add,bootstrap,curate}/SKILL.md` all exist (error); (6) `.github/copilot-instructions.md` contains the `<!-- kb:start -->` / `<!-- kb:end -->` sentinel block (warn-level when missing)
- [ ] `detectFromEnv` is NOT implemented (returns `undefined`). Selection happens via `--harness copilot`, `--hint copilot`, or `cliDefaultHarness: copilot`
- [ ] CLI `init` validator accepts `--harnesses copilot` (extend any hardcoded list)
- [ ] `runHeadless`, `parseTranscript`, `renderTranscript` throw `not implemented` placeholders (filled by Tasks 4 and 5)
- [ ] `hook-spec.ts` exists with the four `HookSpec` entries declared (events: `sessionStart`, `sessionEnd`, `agentStop`), each carrying a `payload` blob describing `{ type: 'command', timeoutSec: 30, env: { KB_BUILDER_INTERNAL: '1' } }`. The `bash` field is intentionally absent here; Task 3 renders it in `hooks-config.ts` from the absolute `scriptPath`
- [ ] `hooks-config.ts` exists with an exported `writeCopilotHookConfig(paths)` function whose body is a stub that throws `not implemented` (filled in Task 3)
- [ ] `npm run build` succeeds; `npm test` passes; a registry-level test asserts `getHarness('copilot')` returns the adapter

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/copilot/{index,install,hook-spec,hooks-config,doctor,opts,transcript,headless}.ts`
- `src/harnesses/registry.ts` (add Copilot)
- `execa` for `copilot --version`
- `zod` for the opts schema
- `os.homedir()` for `~/.copilot` resolution

## Input Dependencies

- Task 1 (`HookSpec.payload` field available)

## Output Artifacts

- Working Copilot adapter scaffold registered in the global registry
- Doctor checks, paths, opts schema, install skeleton, hook-spec entries declared with payload blobs

## Implementation Notes

<details>
<summary>Guidance</summary>

- Use the Codex and OpenCode adapters as side-by-side references for module layout. The Copilot adapter is closest to Codex (single hook-config JSON file, no in-process plugin shim) but installs skills outside `<dir>/`.
- `paths.skillsDir = path.join(root, '.github', 'skills')` deliberately lives outside `<root>/.copilot/`. This is the Copilot-documented project skill location and avoids colliding with `.claude/skills/` and `.agents/skills/` in mixed-harness installs.
- `paths.dir = path.join(root, '.copilot')` is a KB-tool convention. Copilot itself does not read this directory. Document this in a brief comment inside `paths()` or in `map-copilot-harness-adapter.md` (Task 7 owns the KB node).
- `paths.settingsFile = path.join(os.homedir(), '.copilot', 'hooks', 'kb.json')`. This is the file Copilot actually reads. Honor `COPILOT_HOME` if set: `process.env.COPILOT_HOME ?? path.join(os.homedir(), '.copilot')`.
- Hook-spec entries:
  ```ts
  export const copilotHookSpecs: HookSpec[] = [
    { event: 'sessionStart', scriptPath: 'kb-session-start.mjs', payload: { type: 'command', timeoutSec: 30, env: { KB_BUILDER_INTERNAL: '1' } } },
    { event: 'sessionStart', scriptPath: 'kb-proposal-drain.mjs', async: true, payload: { type: 'command', timeoutSec: 30, env: { KB_BUILDER_INTERNAL: '1' } } },
    { event: 'sessionEnd',   scriptPath: 'kb-capture.mjs',        payload: { type: 'command', timeoutSec: 30, env: { KB_BUILDER_INTERNAL: '1' } } },
    { event: 'sessionEnd',   scriptPath: 'kb-lint-tick.mjs',      payload: { type: 'command', timeoutSec: 30, env: { KB_BUILDER_INTERNAL: '1' } } },
    { event: 'agentStop',    scriptPath: 'kb-capture.mjs',         payload: { type: 'command', timeoutSec: 30, env: { KB_BUILDER_INTERNAL: '1' } } },
  ];
  ```
- Doctor `copilot --version`: use `execa` with `reject: false`. Treat ENOENT as a failed error-level check pointing the user at `https://github.com/github/copilot-cli`.
- For the auth doctor check: try `process.env.COPILOT_GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN`. If none, check `fs.existsSync(path.join(os.homedir(), '.copilot', 'settings.json'))`. Emit a warn if both signals are absent telling the user to run `copilot /login`.
- Per `feedback_no_backwards_compat`: no fallback for a legacy hook file location; `~/.copilot/hooks/kb.json` is canonical.
- Per `feedback_no_em_dashes`: avoid `—`, `–`, ` - ` in comments and Zod descriptions.

</details>
