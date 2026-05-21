---
id: 6
group: "cursor-adapter"
dependencies: [3, 4, 5]
status: "completed"
created: "2026-05-21"
skills:
  - typescript
  - unit-testing
---
# Add Cursor harness integration tests and doctor coverage

## Objective

Add focused integration tests under `tests/harnesses/cursor/` covering env collision, install round-trip, hooks-config snapshots, capture smoke, and headless runner contract. Extend `tests/harnesses/registry.test.ts` and `detect.test.ts` for the fourth harness without duplicating framework tests.

## Skills Required

- typescript
- unit-testing

## Acceptance Criteria

- [ ] `tests/harnesses/cursor/` includes meaningful tests (not framework trivia): hooks-config merge, transcript parser (if not only in task 4), headless shim, capture hook stdin fixture
- [ ] Env collision: `CURSOR_VERSION` + `CLAUDE_PROJECT_DIR`, no `CLAUDECODE` → `cursor`; `CLAUDECODE=1` → `claude`
- [ ] Install test (temp dir): `init --harnesses cursor` writes `.cursor/hooks.json`, four `kb-*.cjs`, three `.cursor/skills/kb-*/SKILL.md` with `cursor` in REGISTERED
- [ ] Quad-harness test: `init --harnesses claude,codex,cursor,opencode` yields byte-identical shared SKILL.md across four skill dirs
- [ ] `doctor --harness cursor` returns zero errors on fresh install when `agent` shim is on PATH (mock or fake binary in test)
- [ ] `npm run lint:detect-harness` passes; removing `cursor` from heredoc fails lint (document in test comment or separate assertion)
- [ ] `npm test` passes; no real `claude`/`agent` required on PATH except mocked subprocesses

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `tests/harnesses/cursor/*.test.ts`
- `tests/harnesses/detect.test.ts`, `registry.test.ts` updates
- Vitest patterns from `tests/harnesses/codex/`

## Input Dependencies

- Tasks 3, 4, 5 (hooks, parser, headless implemented)

## Output Artifacts

- CI-green harness coverage for Cursor success criteria 1–8 (except manual sessionStart validation)

## Implementation Notes

<details>
<summary>Meaningful Test Strategy Guidelines</summary>

Your critical mantra for test generation is: **write a few tests, mostly integration**.

**Definition of "Meaningful Tests":** Tests that verify custom business logic, critical paths, and edge cases specific to the application. Focus on testing YOUR code, not the framework or library functionality.

**When TO Write Tests:**
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality
- Integration points between different system components
- Complex validation logic or calculations

**When NOT to Write Tests:**
- Third-party library functionality (already tested upstream)
- Framework features (React hooks, Express middleware, etc.)
- Simple CRUD operations without custom logic
- Getter/setter methods or basic property access
- Configuration files or static data
- Obvious functionality that would break immediately if incorrect

Combine related scenarios in one file where sensible (e.g. install + hooks.json in one integration test).

</details>

<details>
<summary>Guidance</summary>

- Align with plan Self Validation items 1–7 where automatable; item 8 (KB files) is Task 7.
- Never add env-detection branches in production code for tests; mock env in test process only.
- Claude subprocess remains mocked project-wide.

</details>
