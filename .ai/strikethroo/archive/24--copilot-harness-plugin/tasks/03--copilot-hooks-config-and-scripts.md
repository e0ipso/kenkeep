---
id: 3
group: "copilot-adapter"
dependencies: [2]
status: "completed"
created: 2026-05-15
skills:
  - typescript
  - node
---

# Implement Copilot hooks-config writer, sentinel writer, and per-event hook scripts

## Objective

Fill in the bodies of `hooks-config.ts` (which renders the aggregated `{ version: 1, hooks: { ... } }` JSON for both `~/.copilot/hooks/kb.json` and `<root>/.copilot/hooks/kb.json`) and `writeCopilotInstructionsSentinel(paths)` (which idempotently injects the `<!-- kb:start --> ... <!-- kb:end -->` sentinel block into `.github/copilot-instructions.md` with current INDEX content). Author the four per-event Node hook scripts under `src/harnesses/copilot/hooks/` (compiled by tsup into `templates/copilot/kb-hooks/`): `kb-session-start.mjs`, `kb-proposal-drain.mjs`, `kb-capture.mjs`, `kb-lint-tick.mjs`. `kb-capture.mjs` delegates to the Task 4 transcript parser; here it just reads stdin, locates the events.jsonl path, and calls into `parseCopilotTranscript`.

## Skills Required

- typescript
- node

## Acceptance Criteria

- [ ] `src/harnesses/copilot/hooks-config.ts` exports `writeCopilotHookConfig(paths: HarnessPaths)` which (1) reads the adapter's `copilotHookSpecs`, (2) groups entries by `event`, (3) for each entry renders `{ type: 'command', bash: \`node ${absoluteScriptPath}\`, timeoutSec, env, cwd }` using the `payload` blob as the source of `type` / `timeoutSec` / `env`, (4) writes the resulting `{ version: 1, hooks: { ... } }` JSON via atomic write (tmp + rename) to both `paths.settingsFile` (the user-level `~/.copilot/hooks/kb.json`) and `<paths.dir>/hooks/kb.json` (the project documentation artifact). Both files are byte-identical.
- [ ] `writeCopilotHookConfig` is idempotent: re-running produces the same byte output and the same files.
- [ ] `src/harnesses/copilot/hooks-config.ts` also exports `writeCopilotInstructionsSentinel(paths: HarnessPaths)` which atomically rewrites `<root>/.github/copilot-instructions.md` so the file contains exactly one `<!-- kb:start --> ... <!-- kb:end -->` block at the end of the file, populated with current INDEX content read from `<root>/.ai/knowledge-base/INDEX.md` (fall back to a short placeholder if INDEX.md is absent). Any user-authored content outside the sentinel block is preserved verbatim.
- [ ] The four hook script sources live at `src/harnesses/copilot/hooks/{kb-session-start,kb-proposal-drain,kb-capture,kb-lint-tick}.ts`. They are emitted as `templates/copilot/kb-hooks/*.mjs` by the existing tsup pipeline (no pipeline change needed; the templates discovery already handles a `kb-hooks/` rename for adapters that own `hooks/` source dirs).
- [ ] Each hook script starts with an early-exit guard: `if (process.env.KB_BUILDER_INTERNAL === '1') process.exit(0);`. Followed by a no-op guard: if `<cwd>/.ai/knowledge-base/` is absent, exit 0 silently.
- [ ] `kb-session-start.mjs` reads stdin JSON `{ sessionId, cwd, ... }`, calls `writeCopilotInstructionsSentinel(paths)` against `<cwd>/.github/copilot-instructions.md`, exits 0. Errors logged to stderr, never re-thrown.
- [ ] `kb-proposal-drain.mjs` is the async drain analog: reads stdin, calls into the shared proposal-drain helper, exits 0. Mirrors the OpenCode counterpart.
- [ ] `kb-capture.mjs` reads stdin JSON `{ sessionId, cwd, ... }`, computes `eventsFile = path.join(process.env.COPILOT_HOME ?? path.join(os.homedir(), '.copilot'), 'session-state', sessionId, 'events.jsonl')`, calls `parseCopilotTranscript(eventsFile)` (Task 4 owns the body; here it imports the function and feeds the result through `captureSession()` with `captured_by: 'copilot-session-end'` or `'copilot-agent-stop'` driven by the stdin payload's `hook_event_name`).
- [ ] `kb-lint-tick.mjs` mirrors the existing OpenCode / Codex lint-tick script.
- [ ] All four scripts exit `0` unconditionally even on error. Errors go to stderr only so they never block the Copilot session.
- [ ] Unit tests cover: (1) `writeCopilotHookConfig` produces a deterministic JSON document and both files match byte-for-byte; (2) `writeCopilotInstructionsSentinel` preserves user content outside the sentinel block; (3) re-running the sentinel writer with the same INDEX yields zero-diff; (4) the capture script no-ops when `.ai/knowledge-base/` is missing.
- [ ] `npm run build` succeeds and emits all four files under `templates/copilot/kb-hooks/`.
- [ ] `npm test` passes including the new fixtures.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/copilot/hooks-config.ts`
- `src/harnesses/copilot/hooks/{kb-session-start,kb-proposal-drain,kb-capture,kb-lint-tick}.ts`
- `fs.promises` for atomic writes (write to `.tmp`, `rename`)
- Existing `captureSession()` shared pipeline
- Test fixtures under `tests/fixtures/copilot-*` (sentinel preservation cases, hook JSON snapshot)

## Input Dependencies

- Task 2 (adapter scaffold; this task fills the `writeCopilotHookConfig` and `writeCopilotInstructionsSentinel` stubs and authors the hook script sources)

## Output Artifacts

- Working `writeCopilotHookConfig` producing valid Copilot hook JSON
- Working `writeCopilotInstructionsSentinel` producing idempotent sentinel-block rewrites
- Compiled per-event hook scripts under `templates/copilot/kb-hooks/`

## Implementation Notes

<details>
<summary>Guidance</summary>

- Atomic write pattern: `await fs.writeFile(target + '.tmp', payload); await fs.rename(target + '.tmp', target);`. Ensure parent dir exists with `fs.mkdir(path.dirname(target), { recursive: true })`.
- The aggregated hook JSON shape:
  ```json
  {
    "version": 1,
    "hooks": {
      "sessionStart": [
        { "type": "command", "bash": "node /abs/path/.copilot/kb-hooks/kb-session-start.mjs", "timeoutSec": 30, "env": { "KB_BUILDER_INTERNAL": "1" } },
        { "type": "command", "bash": "node /abs/path/.copilot/kb-hooks/kb-proposal-drain.mjs", "timeoutSec": 30, "env": { "KB_BUILDER_INTERNAL": "1" } }
      ],
      "sessionEnd": [
        { "type": "command", "bash": "node /abs/path/.copilot/kb-hooks/kb-capture.mjs", "timeoutSec": 30, "env": { "KB_BUILDER_INTERNAL": "1" } },
        { "type": "command", "bash": "node /abs/path/.copilot/kb-hooks/kb-lint-tick.mjs", "timeoutSec": 30, "env": { "KB_BUILDER_INTERNAL": "1" } }
      ],
      "agentStop": [
        { "type": "command", "bash": "node /abs/path/.copilot/kb-hooks/kb-capture.mjs", "timeoutSec": 30, "env": { "KB_BUILDER_INTERNAL": "1" } }
      ]
    }
  }
  ```
  Note `bash` is a single shell command; Copilot's hook runner pipes the stdin payload into it automatically (no `< file` redirect needed).
- The sentinel block format:
  ```
  <!-- kb:start -->
  <INDEX.md contents here>
  <!-- kb:end -->
  ```
  Use a single line for each marker and put the block at the very end of the file. If the file already contains a sentinel block, replace exactly the content between the markers and preserve everything else.
- For idempotency on a no-op rewrite, read the file first; if the post-write content equals the pre-write content byte-for-byte, skip the rename to avoid touching mtime. Optional optimization; not required for correctness.
- Per `feedback_no_backwards_compat`: no migration from a non-sentinel `.github/copilot-instructions.md` legacy layout; the writer simply appends a fresh sentinel block when none exists.
- Per `feedback_no_em_dashes` and `feedback_no_retrospective_framing`: no `—` and no "previously the file did X" prose in any sentinel block placeholder content.

</details>
