---
id: 5
group: "cli-launchers"
dependencies: [4]
status: "completed"
created: 2026-05-23
skills:
  - typescript
  - bash
---
# Convert `bootstrap` / `curate` / `node add` CLI to thin harness-dispatching launchers and rename `bootstrap-incremental`

## Objective
Reshape the user-facing top-level CLI commands so that each does exactly one thing: exec the corresponding skill in the user's chosen harness (`<harness> -p "/kb-<name> …"`). Rename `bootstrap-incremental` to `bootstrap` and register the old name as a deprecation alias that prints a stderr notice for one release.

## Skills Required
- `typescript` — rewrite the commander command bodies and the `child_process.spawn` plumbing.
- `bash` — verify the resulting `execve` shape against the validation steps.

## Acceptance Criteria
- [ ] `src/commands/bootstrap-incremental.ts` is renamed to `src/commands/bootstrap.ts`; the command is registered as `ai-kb bootstrap`. Old `bootstrap-incremental` registration remains as an alias that (a) executes the same launcher and (b) prints a clear `[deprecated] use 'ai-kb bootstrap'` notice to stderr.
- [ ] `ai-kb bootstrap` body: resolve harness (existing resolver), exec `<harness> -p "/kb-bootstrap --from <scope>"` (or the harness-appropriate equivalent), set `KB_BUILDER_INTERNAL=1` on the child's env, exit with the child's exit code. **No** internal sub-agent fan-out, no batching, no direct LLM invocation.
- [ ] `ai-kb curate` body: same shape, execs `<harness> -p "/kb-curate …"`. Existing flags pass through unchanged.
- [ ] `ai-kb node add` body: same shape, execs `<harness> -p "/kb-add …"`. Removes the interactive `@inquirer/prompts` flow; the underlying `ai-kb node write` primitive added in Task 2 is still present for the skill to call.
- [ ] `--harness <claude|codex|cursor|opencode>` flag continues to work via the existing resolver; if omitted, auto-detection is unchanged.
- [ ] Each launcher spawns **exactly one** child process per invocation. Validation step 4 in the plan (`strace -f -e execve … | grep claude.*-p`) must show one match, not many.
- [ ] Help output for the old `bootstrap-incremental` includes the word `deprecated`; help for the new `bootstrap` does not.
- [ ] Existing tests that exercised the inline runner from these commands are updated or removed (full deletion of the runner code happens in Task 6).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse the existing harness resolver / detector that today's `BootstrapRunner` and `CuratorRunner` consult (search `src/lib/` for it).
- Use `child_process.spawn` with `stdio: 'inherit'` so the user sees the harness's interactive output and Ctrl-C propagates naturally.
- Inherit `process.env` and overlay `{ KB_BUILDER_INTERNAL: '1' }` on the child.

## Input Dependencies
- Task 4 — the `/kb-bootstrap`, `/kb-curate`, `/kb-add` skills must exist and be drivable in-host before launchers point at them.

## Output Artifacts
- A CLI surface where `bootstrap` / `curate` / `node add` are pure launchers, exactly as required by validation step 4.
- A clean baseline for Task 6 to delete `BootstrapRunner` and `CuratorRunner`.

## Implementation Notes
<details>
<summary>Details</summary>

- Keep flag names and semantics stable for `--from`, `--harness`, and any other user-facing options. Users / CI may already pass them.
- The launcher is intentionally dumb. It does not parse, validate, or rewrite the user's flags beyond passing `--from <scope>` through to the slash-command argument string. If today's command had extra flags that drove runner behavior (e.g., parallelism, batch size), drop them — they have no meaning in the launcher world. Mention each dropped flag in the release notes (Task 7).
- For the deprecation alias on `bootstrap-incremental`: register the alias via commander (`.alias('bootstrap-incremental')`) **or** as a parallel subcommand whose action wraps the new one and prepends the stderr notice. Either works; pick whichever leaves the `--help` text cleanest.
- Test the launcher minimally — exhaustive testing of the harness child belongs to the harness, not us. One integration test per launcher confirming "spawn was called with the expected argv, env contained `KB_BUILDER_INTERNAL=1`" is enough.
- Do not delete `BootstrapRunner` / `CuratorRunner` yet — Task 6 owns deletion. Just stop calling them from the CLI surface.
- Validation step 4 in the plan uses `strace`. Confirm locally before opening the PR.

</details>
