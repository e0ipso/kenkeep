---
id: 5
group: "copilot-adapter"
dependencies: [2]
status: "completed"
created: 2026-05-15
skills:
  - typescript
---

# Implement the Copilot headless runner using `copilot -p`

## Objective

Wire the `runHeadless` slot for the Copilot adapter. Spawns `copilot` in programmatic mode, captures stdout, parses the embedded fenced JSON payload via the existing `extractFinalJson()` helper, validates against the caller's Zod schema, and returns the result. Sets `KB_BUILDER_INTERNAL=1` on the child env to prevent hook recursion.

## Skills Required

- typescript

## Acceptance Criteria

- [ ] `src/harnesses/copilot/headless.ts` exports `runHeadlessCopilot(promptBody: string, stdinInput: unknown, schema: ZodType<T>, opts: HeadlessRunOptions): Promise<T>`
- [ ] The spawned argv is `[copilotBin, '-p', '<promptBody plus JSON-serialized stdin appended>', '--no-ask-user', '--allow-all-tools', '--add-dir', <repo-root>, ...(opts.model ? ['--model', opts.model] : [])]`
- [ ] `copilotBin` defaults to `copilot` from PATH; an injected `opts.copilotCli` override is honored for testing (the test in self-validation uses a fake shim)
- [ ] Child env: inherits process.env plus `{ KB_BUILDER_INTERNAL: '1' }`
- [ ] `opts.timeoutMs` enforced via `execa`'s `timeout` option
- [ ] `opts.logFile` (if set) mirrors raw stdout to the file
- [ ] `opts.onMessage` (if set) receives one synthetic `HeadlessStreamMessage` carrying the final result at completion (Copilot does not stream intermediate events)
- [ ] The runner parses the final-stdout text via the shared `extractFinalJson(stdout)` helper, validates against `schema.parse(...)`, and returns the validated value
- [ ] When the model fails to emit a fenced JSON block, the runner throws a precise error including a short head excerpt of the stdout (first 1KB) for diagnostics
- [ ] The adapter's `runHeadless` placeholder (Task 2) is replaced with a call to `runHeadlessCopilot`
- [ ] Unit test uses a fake Node-script shim (placed in a temp dir, executable bit set) that prints a canned final answer with a fenced JSON block; verify the runner returns the parsed value and that the shim's stderr-dumped `process.env.KB_BUILDER_INTERNAL` equals `'1'`
- [ ] `npm run build` succeeds
- [ ] `npm test` passes including the new headless test

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/harnesses/copilot/headless.ts`
- `execa` for spawning with timeout
- Existing shared `extractFinalJson()` helper
- `HeadlessRunOptions`, `HeadlessStreamMessage` shared types

## Input Dependencies

- Task 2 (adapter scaffold; placeholder `runHeadless` gets filled in here)

## Output Artifacts

- Working headless runner usable by `curate` and `bootstrap-incremental` when invoked with `--harness copilot`

## Implementation Notes

<details>
<summary>Guidance</summary>

- Prompt assembly mirrors Codex / OpenCode: `const fullPrompt = promptBody + "\n\n--- input ---\n" + JSON.stringify(stdinInput, null, 2);`. The model is instructed by the existing prompt templates to emit a fenced JSON block at the end of its answer.
- `--add-dir <repo-root>` lets the agent read the project files. Pass `process.cwd()` unless `opts.repoRoot` is set.
- The `--model` flag is omitted when `opts.model` is undefined so Copilot uses its configured default.
- Per the plan, both `--no-ask-user` and `--allow-all-tools` are required for fully autonomous non-interactive operation. Do not make them optional.
- For the timeout behavior: when `execa` times out it throws with a `timedOut` flag. Rethrow as a descriptive error including the timeout value.
- Per `feedback_no_backwards_compat`: do not implement a fallback to `--json` if the binary advertises it in a future version; the embedded-JSON contract is the canonical path.

</details>
