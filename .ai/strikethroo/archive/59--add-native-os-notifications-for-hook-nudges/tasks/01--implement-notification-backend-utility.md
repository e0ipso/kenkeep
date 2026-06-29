---
id: 1
group: "notification-core"
dependencies: []
status: "completed"
created: 2026-06-29
skills:
  - node-processes
  - vitest
complexity_score: 6
complexity_notes: "Cross-platform command construction, fire-and-forget process handling, and test seams are cohesive but moderately risky for hook startup behavior."
---
# Implement the shared notification backend utility

## Objective
Add one shared Node built-in notification utility that hook code can call with a title and body. The utility selects the supported local backend for the current platform, spawns it without a shell, returns without waiting for delivery, and treats every missing-backend or backend failure as a silent skip.

## Skills Required
Node process spawning and Vitest coverage for backend selection, argument construction, and failure behavior.

## Acceptance Criteria
- [ ] A shared module under `src/lib/` exposes a small hook-facing API for attempting one OS notification with a title/body pair, plus testable helpers for backend selection and command argument construction.
- [ ] macOS uses `osascript` with an AppleScript `display notification` expression; Linux uses `notify-send`; unsupported platforms return without spawning.
- [ ] Commands are spawned without a shell, with ignored stdio, and without awaiting delivery. Spawn errors, missing commands, headless sessions, CI, DBus failures, or notification permission failures do not throw through the hook-facing API.
- [ ] AppleScript string literals are escaped by the utility and covered by tests for quotes, backslashes, and multiline or punctuation-heavy bodies.
- [ ] `notify-send` arguments include a kenkeep application identity and do not use action, wait, or network-oriented flags.
- [ ] `npx vitest run tests/lib/notifications.test.ts` exits 0 and covers macOS argument construction, Linux argument construction, unsupported-platform skip behavior, and non-fatal spawn failure without requiring real `osascript` or `notify-send` binaries.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Use only Node built-ins; do not add a runtime dependency, daemon, service, Docker image, sidecar, or external runtime.
- Keep backend-specific command construction isolated from the public send API so future backends can reuse the public shape without spreading platform logic into hooks.
- Do not probe with blocking preflight commands. Attempt the platform backend and ignore failure.
- Keep the API small enough for Claude, Codex, Cursor, OpenCode, and the future Copilot shared SessionStart path to call without harness-specific backend knowledge.

## Input Dependencies
None.

## Output Artifacts
A shared notification utility and focused unit tests. Task 3 consumes the public API when wiring SessionStart hooks.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Inspect existing `src/lib/` module style and current test mocking patterns before naming the file. Prefer a neutral name such as `src/lib/notifications.ts` unless the surrounding code suggests a stronger convention.
3. Use `child_process.spawn` directly or through a tiny injectable wrapper for tests. Spawn with an argv array, never `{ shell: true }`.
4. For macOS, generate an AppleScript expression equivalent to displaying a notification with title and body. Escape backslashes and double quotes in AppleScript string literals; keep the escaping helper unit-tested.
5. For Linux, build a `notify-send` invocation with a kenkeep app name and the provided title/body. Do not add `--wait`, actions, urgency tuning, or backend-specific options that the plan does not require.
6. The hook-facing function should catch synchronous spawn errors and attach a best-effort `error` listener to the child process. It should return immediately and should not report notification failures to stderr.
7. Test philosophy - write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. Do not require real desktop notification binaries, a DBus session, macOS Notification Center, or external network. Cover command construction and the non-fatal send contract.
</details>
