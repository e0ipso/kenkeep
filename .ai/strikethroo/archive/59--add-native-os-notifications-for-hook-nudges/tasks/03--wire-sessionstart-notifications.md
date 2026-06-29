---
id: 3
group: "hook-integration"
dependencies: [1, 2]
status: "completed"
created: 2026-06-29
skills:
  - harness-hooks
  - vitest
complexity_score: 7
complexity_notes: "Touches four bundled hook entry points and must preserve existing machine-readable/context outputs while adding a best-effort side channel."
---
# Wire SessionStart notifications into shared-result hooks

## Objective
Send additive OS notification attempts from the SessionStart hooks that already compute shared nudge data: Claude, Codex, Cursor, and OpenCode. Notify for stale index, curation backlog or overdue nudges, and lint findings while preserving every existing assistant-facing, context-facing, file-based, and stderr output path.

## Skills Required
Harness hook integration across the existing adapter layout and Vitest coverage for hook additivity.

## Acceptance Criteria
- [ ] Claude, Codex, Cursor, and OpenCode SessionStart hooks call the shared notification utility when `notifications.enabled` is true and the shared SessionStart result contains stale-index, curation, or lint nudge signals.
- [ ] Claude still emits its existing `systemMessage`; Codex, Cursor, and OpenCode preserve their existing context/file/stdout or stderr behavior. OS notifications are additive and never replace existing nudge delivery.
- [ ] Routine loaded/status/capture/proposal-drain messages do not trigger OS notifications.
- [ ] Notification event text is derived from the existing `buildSessionStartContext` / `buildNudgeContent` result instead of re-counting state separately in each harness hook.
- [ ] Copilot is not refactored for issue #40. If touched at all, comments or docs only clarify that issue #70 owns moving Copilot onto shared SessionStart parity.
- [ ] Opt-out works: with `notifications.enabled: false`, the same SessionStart hook output is produced and no notification attempt is made.
- [ ] `npm test -- tests/hooks/kk-session-start.test.ts` exits 0 and verifies stale-index, curation, and lint notification attempts for at least one shared-result hook while preserving its existing stdout/context envelope.
- [ ] `npm run build` exits 0, and `rg "notification|notify-send|osascript" dist/hooks/{claude,codex,cursor,opencode}/kk-session-start.cjs` shows the notification helper is bundled into each deployed SessionStart hook artifact.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Route all backend selection and process spawning through the Task 1 utility. Do not duplicate platform logic in harness hook files.
- Read the Task 2 effective settings value through the existing hook settings path.
- Keep hook execution non-blocking and fail-open. Notification errors must not affect hook exit status or context output.
- Keep Copilot out of scope unless the existing code already exposes the shared result without a refactor; do not solve issue #70 here.

## Input Dependencies
Task 1 notification utility and Task 2 effective settings value.

## Output Artifacts
Updated SessionStart hooks for Claude, Codex, Cursor, and OpenCode, plus hook tests proving notification additivity and opt-out behavior.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Read `src/lib/session-start.ts`, `src/lib/prompt-retrieval.ts` only if needed for context, and the four hook files under `src/harnesses/{claude,codex,cursor,opencode}/hooks/` that handle SessionStart.
3. Look for local knowledge nodes under `.ai/kenkeep/nodes/hooks/` and `.ai/kenkeep/nodes/harnesses/` if the hook wiring is unclear. Follow adapter isolation rules: shared logic belongs in `src/lib/`, not in another adapter's directory.
4. Add a small renderer if needed that converts the existing shared SessionStart result into one or more actionable notification title/body pairs. The initial event set is stale index, curation backlog/overdue nudge, and lint findings only.
5. Call the notification utility after the hook has enough information to know an actionable nudge exists, but before exit. The call must not alter stdout JSON envelopes, `additionalContext`, `additional_context`, `.opencode/AGENTS.md`, or Claude `systemMessage` behavior.
6. In tests, mock the notification utility or its spawn wrapper. Assert notification attempts and preserved output together so a regression cannot pass by replacing one channel with the other.
7. Test philosophy - write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. Prefer one focused hook integration test that covers stale index, curation, lint, opt-out, and unsupported platform behavior over one test per harness unless local patterns already parameterize this cleanly.
</details>
