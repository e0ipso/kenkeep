---
id: 2
group: "prompt-time-knowledge-injection"
dependencies: [1]
status: "completed"
created: 2026-06-20
skills:
  - harness-adapters
  - typescript
complexity_score: 7
complexity_notes: "Touches adapter capability modeling plus per-harness hook/config wiring for confirmed prompt-time context channels."
---
# Wire Prompt-Time Harness Hooks

## Objective
Model prompt-time injection as an optional harness adapter capability and wire confirmed native prompt-submit context hooks to the shared retrieval context.

## Skills Required
Harness adapter knowledge for native hook/event integration and TypeScript for adapter contracts, hook scripts, and hook configuration writers.

## Acceptance Criteria
- [ ] `HarnessAdapter` or adjacent adapter metadata represents prompt-time injection as an optional capability without adding global event-name translation or a fake canonical prompt event.
- [ ] Claude Code and Codex are wired through their native `UserPromptSubmit` events after confirming the current hook contract; both emit JSON `hookSpecificOutput` with `hookEventName: "UserPromptSubmit"` and `additionalContext`.
- [ ] Cursor, OpenCode, and GitHub Copilot remain unregistered for prompt-time injection unless implementation verifies a current native prompt-context channel with official docs and a smoke test.
- [ ] Copilot's `userPromptSubmitted` is not used for this feature unless GitHub's hook contract changes, because current docs mark output for that event as not processed.
- [ ] Supported hook scripts call the shared retrieval renderer from task 1, use the existing hook-entry recursion guard, avoid `asyncLauncher`, set a short hard deadline, and fail open with no injected context on missing prompt text, missing KB, malformed KB, timeout, or other errors.
- [ ] Hook specs/config writers are updated only for supported harnesses, using each adapter's native event names and payload shape.
- [ ] Generated templates are sourced from `src/harnesses/<id>/hooks/` and the existing build pipeline, not edited directly under `templates/`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Follow existing adapter boundaries: shared logic belongs in `src/lib/` or `src/commands/`, while host-specific hook payload handling stays under `src/harnesses/<id>/`. Preserve `HookEvent` as opaque `string`; do not introduce a global prompt event enum or translate one host's event vocabulary into another's. Keep prompt-time injection additive and separate from `buildSessionStartContext`.

Use a consistent hook basename such as `kk-prompt-context.ts`/`.cjs` unless implementation discovers a stronger local naming pattern. The hook should parse the native payload's `prompt` string, call retrieval with `paths.nodesDir`, render only when matches exist, and write the native JSON context envelope. Do not print plain text context on stdout for Claude/Codex; use structured JSON so transcript/UI behavior is controlled.

## Input Dependencies
Depends on task 1 for the retrieval and rendering API. Requires inspecting existing adapter hook declarations, hook config writers, host-specific hook payload conventions, and current official host docs before deciding whether any harness beyond Claude/Codex is actually supported.

## Output Artifacts
- Updated harness adapter types/metadata for optional prompt-time support.
- Per-supported-harness prompt-time hook source files, expected initially under `src/harnesses/claude/hooks/` and `src/harnesses/codex/hooks/`.
- Hook spec/config writer updates for supported harnesses.
- Built template outputs after running the established build command.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Start from `src/harnesses/types.ts`, `src/harnesses/registry.ts`, and each adapter's current hook declarations. Confirm native prompt-submit support from code/docs already present in the repo and current official host docs; do not infer support just because another harness has a similar concept. Unsupported adapters should have no new hook registered and should keep existing session-start behavior exactly as-is.

When adding hook files, mirror the local patterns in each adapter directory. Hook code should be self-contained after tsup bundling and should use only supported dependencies. Keep runtime behavior one-shot and bounded: read the prompt payload, call the retrieval module, emit the host-specific additional context shape, and exit successfully on missing KB, missing prompt text, stale/malformed data, or timeout-like failures.

Before closing this task, run the build path that compiles hooks and copies templates. Do not hand-edit generated files under `templates/`; they should be build output from source changes. Do not edit `src/templates-source/prompts/*.md` for this task; no LLM prompt behavior is needed for deterministic retrieval.
</details>
