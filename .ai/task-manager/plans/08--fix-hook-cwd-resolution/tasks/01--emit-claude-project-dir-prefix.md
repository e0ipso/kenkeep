---
id: 1
group: "hook-command-emission"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Emit `$CLAUDE_PROJECT_DIR`-prefixed hook commands and refresh dogfood settings

## Objective

Change the Claude adapter so every emitted hook command resolves the script path against `$CLAUDE_PROJECT_DIR` instead of the process CWD, keep the `EXPECTED_HOOK_COMMANDS` detector constant in `init.ts` in byte-for-byte lockstep with the new emission, and rewrite this repo's committed `.claude/settings.json` to match. Together these three edits remove the `MODULE_NOT_FOUND` failure that occurs when a Claude Code session runs from a subdirectory of the workspace.

## Skills Required

- typescript: edit a template-string literal in an adapter class, update a const-array of expected commands, and hand-edit a small JSON file.

## Acceptance Criteria

- [ ] `src/adapters/claude.ts` line 58 emits `node "$CLAUDE_PROJECT_DIR/${hook.scriptPath}"` (double-quoted, exactly as written).
- [ ] All five entries in `EXPECTED_HOOK_COMMANDS` (`src/commands/init.ts` lines 340-353) use the new command strings, byte-for-byte identical to what the adapter emits.
- [ ] `/workspace/.claude/settings.json` has every owned `command` value updated to `node "$CLAUDE_PROJECT_DIR/.claude/hooks/<script>.mjs"`. The `Stop`, `SessionEnd`, `PreCompact`, and both `SessionStart` entries are rewritten; the async flag on `kb-proposal-drain.mjs` is preserved; no other keys are touched.
- [ ] `npm run build` succeeds.
- [ ] Manually invoking the Stop hook command from a subdirectory no longer fails with `MODULE_NOT_FOUND`:
      ```bash
      mkdir -p /tmp/kb-cwd-repro && cd /tmp/kb-cwd-repro
      CLAUDE_PROJECT_DIR=/workspace sh -c 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs" </dev/null; echo "exit=$?"'
      ```
      Output must not contain `MODULE_NOT_FOUND`. (A non-zero exit from a different cause, such as missing transcript input, is acceptable.)
- [ ] No retrospective framing, no legacy/migration shim, no new env-var sentinel.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files:
  - `src/adapters/claude.ts` (template literal at line 58).
  - `src/commands/init.ts` (`EXPECTED_HOOK_COMMANDS` array at lines 340-353).
  - `.claude/settings.json` at the repo root.
- Double quotes around `$CLAUDE_PROJECT_DIR/...` are required so the POSIX shell expands the variable and tolerates paths containing spaces. Single quotes would suppress expansion; bare unquoted would word-split on spaces.
- The adapter's owned-entry filter at `src/adapters/claude.ts:44-49` matches the `.claude/hooks/kb-` substring; the new commands still contain that substring, so idempotent stripping continues to work without any new sentinel.
- `EXPECTED_HOOK_COMMANDS` drives `hookRegistrationsNeedRefresh()` via exact string equality (`init.ts:369`). Any character-level mismatch between the constant and the adapter's emission silently breaks the auto-refresh: it either fails to fix existing installs, or rewrites `.claude/settings.json` on every `init` run.

## Input Dependencies

None.

## Output Artifacts

- Edited `src/adapters/claude.ts`.
- Edited `src/commands/init.ts`.
- Edited `.claude/settings.json` (repo root).

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Adapter template**: open `src/adapters/claude.ts`. At line 58, replace:

   ```ts
   const command = `node ${hook.scriptPath}`;
   ```

   with:

   ```ts
   const command = `node "$CLAUDE_PROJECT_DIR/${hook.scriptPath}"`;
   ```

   Do not add a comment. The env-var dependency is visible in the template string itself.

2. **Init detector constant**: open `src/commands/init.ts`. The array at lines 340-353 must mirror the adapter exactly. Rewrite each `command` field:

   ```ts
   const EXPECTED_HOOK_COMMANDS: Array<{ event: string; command: string; async?: boolean }> = [
     { event: 'Stop', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"' },
     { event: 'SessionEnd', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"' },
     { event: 'PreCompact', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"' },
     {
       event: 'SessionStart',
       command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-proposal-drain.mjs"',
       async: true,
     },
     {
       event: 'SessionStart',
       command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-session-start.mjs"',
     },
   ];
   ```

   The literal contains an embedded double-quote pair around `$CLAUDE_PROJECT_DIR/...`; use single-quoted JS strings so no escaping is needed.

3. **Dogfood settings file**: open `/workspace/.claude/settings.json`. Replace each `"command": "node .claude/hooks/<script>.mjs"` line with `"command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/<script>.mjs\""`. Inside JSON the double quotes must be escaped as `\"`. After the edit, the five owned commands should read (in order they appear):
   - `Stop`: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"`
   - `SessionEnd`: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"`
   - `PreCompact`: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-capture.mjs"`
   - `SessionStart` (with `"async": true`): `node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-proposal-drain.mjs"`
   - `SessionStart`: `node "$CLAUDE_PROJECT_DIR/.claude/hooks/kb-session-start.mjs"`

   Preserve the existing structure (matchers, `async`, two-space indentation, trailing newline).

4. **Build**: run `npm run build` from `/workspace`. Fix any type errors before moving on; none are expected since only string literals changed.

5. **Smoke verification**: run the repro from the acceptance criteria. Confirm the output contains no `MODULE_NOT_FOUND`. (Other non-zero exits are acceptable at this stage; the regression test in the next task locks down the contract precisely.)

</details>
