---
id: 5
group: "opencode-adapter"
dependencies: [4]
status: "completed"
created: 2026-05-15
skills:
  - typescript
  - node
---

# Implement the OpenCode plugin shim and non-capture per-event hook scripts

## Objective

Write the TS sources that the build pipeline (Task 2) compiles into:

- `templates/opencode/plugins/kb.mjs` — the plugin shim that subscribes to OpenCode's `event` hook and spawns our per-event Node scripts via `child_process.spawn` with the appropriate stdin payload
- `templates/opencode/kb-hooks/kb-session-start.mjs` — handler for `session.created`
- `templates/opencode/kb-hooks/kb-proposal-drain.mjs` — async handler for `session.created`
- `templates/opencode/kb-hooks/kb-lint-tick.mjs` — handler for `session.idle`

The capture script (`kb-capture.ts`) is intentionally scoped to Task 6 because it depends on the transcript parser.

## Skills Required

- typescript
- node

## Acceptance Criteria

- [ ] `src/harnesses/opencode/plugins/kb.ts` exports the default `async (input, options) => ({ event: handler })` plugin contract. The handler dispatches on `event.type` and spawns the appropriate script(s) from `.opencode/kb-hooks/` (path resolved relative to the plugin's project root, available on `input.directory` or `input.project.worktree`)
- [ ] Plugin spawns children with `KB_BUILDER_INTERNAL=1` always set in the child env, plus `{ stdio: ['pipe', 'inherit', 'inherit'] }` so stdout/stderr stream to the OpenCode log
- [ ] Plugin writes the JSON stdin payload to the child and closes stdin
- [ ] Plugin checks `process.env.KB_BUILDER_INTERNAL` at module load and returns a no-op `{}` if set (recursion guard for when our headless runner spawns `opencode run`)
- [ ] Plugin uses Node built-ins only (`child_process`, `path`, `process`); no npm imports. Zero dependencies in the compiled `.mjs` output (verified by grep against the build artifact)
- [ ] Each per-event script (`kb-session-start.ts`, `kb-proposal-drain.ts`, `kb-lint-tick.ts`) reads `JSON.parse(stdin)`, validates `session_id` and `cwd`, and delegates to the shared pipeline functions used by the Claude/Codex equivalents (`runSessionStart`, `runProposalDrain`, `runLintTick` or equivalent helpers in `src/lib/`)
- [ ] Scripts exit `0` even on internal errors to avoid blocking the plugin's event loop. Errors are logged to stderr only
- [ ] Plugin emits a leading `// @e0ipso/ai-knowledge-base opencode plugin` marker comment after build (for the doctor check in Task 4)
- [ ] Stdin payload contract: `{ session_id: string, hook_event_name: 'SessionCreated' | 'SessionIdle', cwd: string }` (matches the shape Claude/Codex scripts already consume; the `hook_event_name` is the canonical-ish name our shared pipeline switches on)
- [ ] `npm run build` succeeds and emits the four expected `.mjs` artifacts under `templates/opencode/`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/opencode/plugins/kb.ts`
- `src/harnesses/opencode/hooks/kb-session-start.ts`
- `src/harnesses/opencode/hooks/kb-proposal-drain.ts`
- `src/harnesses/opencode/hooks/kb-lint-tick.ts`
- Shared helpers in `src/lib/` consumed by the Claude/Codex equivalents

## Input Dependencies

- Task 4 (adapter scaffold + hook spec defines the script names)

## Output Artifacts

- One plugin shim, three per-event scripts, all built into `templates/opencode/`

## Implementation Notes

<details>
<summary>Guidance</summary>

- Plugin sketch:
  ```ts
  export default async (input, options) => {
    if (process.env.KB_BUILDER_INTERNAL === '1') return {};
    const projectDir = input.directory ?? input.project?.worktree;
    const kbHooks = path.join(projectDir, '.opencode', 'kb-hooks');
    return {
      event: async ({ event }) => {
        const dispatch = {
          'session.created': ['kb-session-start.mjs', 'kb-proposal-drain.mjs'],
          'session.idle': ['kb-capture.mjs', 'kb-lint-tick.mjs'],
        }[event.type];
        if (!dispatch) return;
        const payload = JSON.stringify({
          session_id: event.properties?.sessionID,
          hook_event_name: event.type === 'session.created' ? 'SessionCreated' : 'SessionIdle',
          cwd: projectDir,
        });
        for (const script of dispatch) {
          const child = spawn('node', [path.join(kbHooks, script)], {
            env: { ...process.env, KB_BUILDER_INTERNAL: '1' },
            stdio: ['pipe', 'inherit', 'inherit'],
          });
          child.stdin.write(payload);
          child.stdin.end();
        }
      },
    };
  };
  ```
- The plugin does not await the child processes; OpenCode's event handler should return quickly. Children run to completion in the background.
- Per the plan: "OpenCode session-start equivalent is weaker than Claude's." For v1, `kb-session-start.mjs` writes INDEX.md content to `.opencode/AGENTS.md` or a similar disk location. Do not attempt `experimental.chat.system.transform` (out of scope per plan).
- All scripts reuse the existing shared pipeline. The OpenCode-specific work in this task is the dispatch shim, not the pipeline.

</details>
