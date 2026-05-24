---
id: 4
group: "testing"
dependencies: [1, 2]
status: "completed"
created: "2026-05-24"
skills: ["typescript", "vitest"]
complexity_score: 4
complexity_notes: "Three test files to update/create, but each test case is straightforward"
---
# Add tests for hook eligibility gates, default cap removal, and CLI primitive

## Objective
Ensure the new behavior introduced by Tasks 1 and 2 is covered by tests: hook early-return paths, the uncapped default drain, and the new `session-log update-proposals` CLI primitive.

## Skills Required
TypeScript + Vitest — this project uses Vitest for testing (see existing test patterns in `tests/`).

## Acceptance Criteria
- [ ] `tests/lib/proposal-drain.test.ts`: New test verifying that the default (no explicit `maxEntries`) now processes all entries (not just 5)
- [ ] `tests/hooks/kb-proposal-drain.test.ts`: New test(s) for the Claude hook early-return path (exits immediately without calling drainProposalQueue)
- [ ] `tests/hooks/kb-proposal-drain.test.ts`: New test(s) for the non-Claude hook early-return when CLI binary is missing from PATH
- [ ] `tests/commands/session-log-update-proposals.test.ts` (new file): Tests for valid input writing frontmatter, invalid input exiting non-zero, and `--status failed` setting error fields
- [ ] All existing tests continue to pass (`npm test`)
- [ ] `npm run typecheck` passes

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The project uses **Vitest** as its test framework. Follow existing test patterns.
- `tests/hooks/kb-proposal-drain.test.ts` tests the compiled hook bundle at `dist/hooks/claude/kb-proposal-drain.cjs` via `node` subprocess execution (see existing test at line 94 for the recursion guard pattern).
- `tests/lib/proposal-drain.test.ts` uses in-process unit testing with mocked dependencies.
- The new `tests/commands/session-log-update-proposals.test.ts` should test the compiled CLI via subprocess execution (similar to how `tests/hooks/kb-proposal-drain.test.ts` works) or test the exported command function directly.

## Input Dependencies
- Task 1: Hook eligibility gates and cap removal (the code being tested)
- Task 2: CLI primitive (the code being tested)

## Output Artifacts
- Modified: `tests/lib/proposal-drain.test.ts`
- Modified: `tests/hooks/kb-proposal-drain.test.ts`
- New file: `tests/commands/session-log-update-proposals.test.ts`

## Implementation Notes

**Meaningful Test Strategy Guidelines**

Your critical mantra for test generation is: "write a few tests, mostly integration".

**When TO Write Tests:**
- Custom business logic and algorithms
- Critical user workflows and data transformations
- Edge cases and error conditions for core functionality
- Integration points between different system components

**When NOT to Write Tests:**
- Third-party library functionality (already tested upstream)
- Framework features
- Simple CRUD operations without custom logic

<details>

### 1. `tests/lib/proposal-drain.test.ts` — Default cap removal

Add one test near the existing `maxEntries` test (around line 199). The existing test passes `maxEntries: 2` explicitly and verifies only 2 are processed. The new test should:

- Create more than 5 pending session logs (e.g., 7)
- Call `drainProposalQueue` WITHOUT passing `maxEntries`
- Assert that ALL 7 entries are processed (not just 5)
- This validates that `DEFAULT_MAX_ENTRIES = Infinity` works correctly

Follow the same test setup pattern as the existing tests: create temp session files with `proposal_status: pending` frontmatter, mock the runner, etc.

### 2. `tests/hooks/kb-proposal-drain.test.ts` — Claude early return

The existing tests run the compiled hook bundle via `node dist/hooks/claude/kb-proposal-drain.cjs`. Add a test that:

- Does NOT set `KB_BUILDER_INTERNAL=1`
- Sets up a valid repo with an installed version marker
- Runs the Claude hook
- Asserts that it exits 0 AND stderr contains the deferral message (`skipping proposal drain — Claude sessions defer extraction to /kb-curate`)
- Asserts that no session logs were processed (proposal_status remains `pending`)

**Important**: The hook bundle needs to be rebuilt before testing (`npm run build`). The existing test setup may already handle this.

### 3. `tests/hooks/kb-proposal-drain.test.ts` — Non-Claude CLI check

This is harder to test directly because the non-Claude hooks are separate files. Consider testing the cursor hook bundle at `dist/hooks/cursor/kb-proposal-drain.cjs`:

- Set PATH to a directory that does NOT contain `agent`
- Run the cursor hook
- Assert exit 0 AND stderr contains the CLI-not-found message
- Assert no session logs were processed

Alternatively, if the test infrastructure only covers the Claude hook bundle, add a focused unit test for the `which` check pattern.

### 4. `tests/commands/session-log-update-proposals.test.ts` — CLI primitive

Create a new test file. Test cases:

**a. Valid `--status done` input:**
- Create a temp session log file with `proposal_status: pending` frontmatter and body containing `(populated by proposal worker)`
- Pipe valid JSON (`{ "practice": [{ "kind": "practice", "tags": ["test"], "title": "Test", "summary": "Test summary", "body": "Test body", "confidence": "high" }], "map": [] }`) via stdin
- Run `node dist/cli.js session-log update-proposals <path> --status done`
- Assert exit code 0
- Assert stdout contains the session_id
- Read the file and assert: `proposal_status: done`, `proposal_completed_at` is set, `proposals.practice` has one entry, body placeholder is replaced

**b. Invalid JSON input with `--status done`:**
- Pipe `"not valid json"` via stdin
- Assert exit code 1
- Assert stderr contains an error message

**c. `--status failed` with error:**
- Create a temp session log with `proposal_status: pending`
- Run with `--status failed --error "extraction timed out"`
- Assert exit code 0
- Read the file and assert: `proposal_status: failed`, `proposal_error: "extraction timed out"`

</details>
