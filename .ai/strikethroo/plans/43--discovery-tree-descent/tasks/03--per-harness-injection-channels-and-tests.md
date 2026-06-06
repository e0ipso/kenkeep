---
id: 3
group: "discovery-tree-descent"
dependencies: [1]
status: "completed"
created: 2026-06-05
skills:
  - typescript
  - vitest
complexity_score: 6
complexity_notes: "Spans all five harness adapters' SessionStart injection channels (additionalContext for Claude/Codex/Copilot, the .opencode/AGENTS.md file path for OpenCode, the Cursor relay caveat) and the per-harness tests that lock in root-only injection plus descent directive. Two skills: the TypeScript channel routing and the vitest coverage."
---
# Route the root-only body through every harness channel and cover with per-harness SessionStart tests

## Objective
Ensure the root-only injected body and the descent directive from task 1 are delivered correctly through every harness SessionStart channel, and lock the behavior in with per-harness tests. Claude, Codex, and Copilot inject via `additionalContext`; OpenCode writes the injection to `.opencode/AGENTS.md` rather than a channel; Cursor silently drops `sessionStart` additional_context and must keep relaying per the existing caveat. No event-name translation across adapters. The per-harness SessionStart tests must confirm the injected payload contains only the root index node body plus the directive, nudge, and staleness lines, and grows by a fixed amount as leaves are added to deep folders.

## Skills Required
- `typescript`: verify and, where needed, adjust the per-harness SessionStart call paths in `src/harnesses/{claude,codex,copilot,cursor,opencode}` so each routes the shared result correctly.
- `vitest`: write/extend per-harness SessionStart tests asserting root-only injection and the descent directive across all channels.

## Acceptance Criteria
- [ ] Claude, Codex, and Copilot SessionStart hooks inject the root-only body plus the descent directive through `additionalContext`.
- [ ] The OpenCode SessionStart path writes the same root-only body plus directive to `.opencode/AGENTS.md`.
- [ ] The Cursor path preserves the existing relay behavior (additional_context is silently dropped on Cursor; the nudge is relayed per the established caveat).
- [ ] No adapter translates event names; each adapter uses its native SessionStart event without renaming.
- [ ] Per-harness tests assert the injected payload contains only the root index node body plus the directive, staleness, and nudge lines, and that the payload grows by a fixed amount (not linearly with node count) as leaves are added to deep folders.
- [ ] A test induces `nodes_hash` drift in a fixture tree KB and confirms the staleness line still appears.
- [ ] No em dashes in any changed file.
- [ ] `npm test`, `npm run typecheck`, and `npm run lint` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files in scope: `src/harnesses/claude`, `src/harnesses/codex`, `src/harnesses/copilot`, `src/harnesses/cursor`, `src/harnesses/opencode` (their SessionStart wiring), and their test files.
- Reuse the `SessionStartResult` shape and the `buildSessionStartContext` output from task 1 unchanged; do not re-implement the body assembly per harness.
- Honor the Cursor additional_context caveat and the OpenCode file write path; do not change either adapter's injection channel.
- No event-name translation across adapters (`practice-no-event-translation-across-adapters`).
- Use a fixture tree KB (root `index.md` plus deep branch/leaf folders) to prove the payload is bounded and independent of total node count.

## Input Dependencies
- Task 1: provides `buildSessionStartContext` injecting the root-only body and the exported descent directive consumed by all five adapters.

## Output Artifacts
- Verified (and, where required, adjusted) per-harness SessionStart wiring in all five adapters.
- Per-harness SessionStart tests proving root-only injection, the descent directive, bounded payload growth, and staleness-on-drift.

## Implementation Notes

Test philosophy for this task: write a few tests, mostly integration.

Definition. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library.

When TO write tests: custom business logic and algorithms; critical user workflows and data transformations; edge cases and error conditions for core functionality; integration points between components; complex validation logic or calculations.

When NOT to write tests: third-party library functionality; framework features; simple CRUD operations without custom logic; trivial getters/setters or static configuration; obvious functionality that would break immediately if incorrect.

Test task creation rules: combine related test scenarios into a single task (e.g. "Test user authentication flow" not separate tasks for login, logout, validation); favor integration and critical-path coverage over per-method unit tests; avoid one test task per CRUD operation; question whether simple functions need a dedicated test task.

<details>
<summary>Step-by-step</summary>

1. Read each adapter's SessionStart wiring under `src/harnesses/{claude,codex,copilot,cursor,opencode}` and confirm each consumes `buildSessionStartContext`'s `SessionStartResult` (from task 1) without re-assembling the body. Because task 1 preserved the result shape, most adapters should need no code change; verify rather than assume.
2. Confirm the additionalContext channel adapters (Claude, Codex, Copilot) emit the root-only body plus directive. Confirm OpenCode writes the same payload to `.opencode/AGENTS.md`. Confirm Cursor still relays per the existing caveat (additional_context dropped; nudge relayed differently). Make the minimum adjustment only if an adapter is not already routing the shared result.
3. Ensure no adapter renames or translates the SessionStart event name for its host.
4. Build a fixture tree KB used by tests: a root `index.md` (with a `nodes_hash` in frontmatter) plus several branch index nodes and deep leaves, matching Plan 1's tree storage shape. Use it to assert bounded payload growth: snapshot the injected length, add leaves in deep folders, and assert the injected body is unchanged except for the fixed root index node body (it must not grow linearly with node count).
5. For each adapter, add or extend a SessionStart test asserting: the injected payload contains the root index node body, the descent directive text (assert on a stable phrase from the shared constant), the nudge line(s), and the staleness line; and that the payload does not grow with deep-leaf additions.
6. Add a drift test: set the live hash to differ from the root index node frontmatter `nodes_hash` and assert the staleness line appears.
7. Run `npm run typecheck`, `npm test`, and `npm run lint`; fix only failures caused by this change.
8. Do not use em dashes in any changed file. Apply hook behavior consistently across all four host harness adapters per `practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters`.

</details>
