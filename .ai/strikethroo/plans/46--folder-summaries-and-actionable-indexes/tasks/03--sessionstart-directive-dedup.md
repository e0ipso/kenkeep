---
id: 3
group: "session-start"
dependencies: [2]
status: "completed"
created: 2026-06-08
skills:
  - typescript
  - vitest
---
# Stop SessionStart (and copilot hooks-config) from double-emitting the descent directive

## Objective
Now that every `ENTRY.md`/`index.md` body embeds the descent directive (Task 2),
the SessionStart injection must stop appending `KK_NAVIGATION_DIRECTIVE` again,
so the injected entry catalog contains the directive exactly once. The
`KK_NAVIGATION_DIRECTIVE` constant stays the single source of truth.

## Skills Required
- `typescript`: adjust `buildSessionStartContext` in `src/lib/session-start.ts` and the copilot `hooks-config.ts` append.
- `vitest`: update `tests/lib/session-start.test.ts` (and the hook test if it asserts the directive) to require exactly one occurrence.

## Acceptance Criteria
- [ ] `buildSessionStartContext` (`src/lib/session-start.ts:73`) no longer appends `KK_NAVIGATION_DIRECTIVE` to the injected body when the loaded `ENTRY.md` already embeds it (the post-Task-2 case).
- [ ] The SessionStart-injected text contains the descent directive **exactly once** (Success Criterion 8).
- [ ] The copilot hooks-config path (`src/harnesses/copilot/hooks-config.ts:113`, which currently does `${body}\n\n${KK_NAVIGATION_DIRECTIVE}`) is reconciled so it does not double-print either, while still keeping `KK_NAVIGATION_DIRECTIVE` as the lone source.
- [ ] The "snapshots in time" verification line and the staleness/nudge/lint behavior are unchanged.
- [ ] The legacy `INDEX.md` fallback path (an upgraded-but-not-yet-rebuilt repo whose old catalog does NOT embed the directive) still results in the agent seeing the directive exactly once — decide and implement the bridging behavior (see Implementation Notes) rather than leaving such a repo with zero directives.
- [ ] Tests assert the single-occurrence invariant for both the embedded-body case and (if bridged) the legacy fallback case.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `KK_NAVIGATION_DIRECTIVE` is defined in `src/lib/session-start.ts:25` and consumed by `init.ts` (AGENTS.md pointer) and `copilot/hooks-config.ts`. Do not move or retext it.
- The injected body is assembled in `buildSessionStartContext`; the directive append is currently line 106 (`lines.push(KK_NAVIGATION_DIRECTIVE)`).
- `loadIndex` (`:178`) returns the catalog body; post-Task-2 that body already contains the directive line.

## Input Dependencies
- Task 2: the generated `ENTRY.md` body now embeds the directive, which is the precondition for removing the hook's append (otherwise the injected catalog would lose it entirely).

## Output Artifacts
- A SessionStart payload carrying the directive exactly once, satisfying Success Criterion 8 and the directive-duplication Implementation Risk mitigation.

## Implementation Notes
The risk this closes is "directive duplication / drift": embedding in the body
while the hook also appends would double-print.

<details>
<summary>Detailed implementation guidance</summary>

1. **Remove the unconditional append.** Delete or guard the
   `lines.push(KK_NAVIGATION_DIRECTIVE)` at `session-start.ts:106` (and the blank
   line before it at `:105` if it leaves a stray double blank).

2. **Legacy fallback bridge.** `loadIndex` falls back to `INDEX.md` for repos
   seeded before the `ENTRY.md` rename (`:181`); that old body does NOT embed the
   directive. Two acceptable resolutions — implement one and test it:
   - (a) Detect whether the loaded body already contains the directive (substring
     check against `KK_NAVIGATION_DIRECTIVE`) and append it only when absent. This
     guarantees exactly-once across both new and legacy bodies. **Preferred** — it
     is the most robust and is a single conditional.
   - (b) Always rely on the embedded directive and accept that a legacy
     not-yet-rebuilt repo shows none until its first `index rebuild`. Only choose
     this if (a) is rejected in review; it weakens Criterion 8 for legacy repos.
   Prefer (a).

3. **Copilot hooks-config.** `src/harnesses/copilot/hooks-config.ts:113` appends
   the directive to a body. If that body is the generated catalog (post-Task-2,
   embedded), apply the same substring guard so copilot does not double-print.
   Confirm what `body` is at that call site before changing it; if it is a
   different surface that legitimately needs the directive, leave it but document
   why.

4. **Tests** (`tests/lib/session-start.test.ts`, and `tests/hooks/kk-session-start.test.ts` if it asserts directive text):
   - Build context from an `ENTRY.md` that embeds the directive; assert the
     injected `additionalContext` contains `KK_NAVIGATION_DIRECTIVE` exactly once
     (count occurrences, expect 1).
   - If bridge (a) is implemented, build from a legacy `INDEX.md` body lacking the
     directive and assert it is appended exactly once.
   - Assert the staleness/nudge lines still appear under their existing
     conditions (no regression).

**Test philosophy — "write a few tests, mostly integration".** Meaningful tests
verify custom business logic, critical paths, and edge cases specific to this
application. Test *your* code, not the framework. WRITE tests for: custom
business logic and algorithms; critical workflows and data transformations; edge
cases and error conditions for core functionality; integration points; complex
validation. Do NOT write tests for: third-party library functionality; framework
features; simple CRUD without custom logic; trivial getters/setters or static
config; obvious functionality that would break immediately if incorrect. The
exactly-once invariant across embedded and legacy bodies is the behavior to
cover; one assertion per path suffices.
</details>
