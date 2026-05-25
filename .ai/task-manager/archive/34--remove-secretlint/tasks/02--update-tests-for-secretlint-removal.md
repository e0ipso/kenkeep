---
id: 2
group: "testing"
dependencies: [1]
status: "completed"
created: 2026-05-25
skills:
  - vitest
---
# Update tests after secretlint removal

## Objective
Remove or rewrite all tests that exercise the deleted secretlint scanning functionality so the suite reflects the simplified capture pipeline (direct write, no scan/redact/block paths).

## Skills Required
Vitest — follow existing patterns in `tests/lib/` and `tests/hooks/`.

## Acceptance Criteria
- [ ] `tests/lib/secret-scan.test.ts` is deleted
- [ ] `tests/lib/capture.test.ts` drops `fakeScanner` and all `secret-scan-blocked` assertions; remaining tests pass without a scanner
- [ ] `tests/lib/memory-files.test.ts` drops secretlint-blocked and secretlint-redacted scenarios; scanner-related setup is removed
- [ ] `tests/hooks/kb-capture.test.ts` no longer references secretlint; assertions verify capture succeeds
- [ ] `tests/hooks/codex/kb-capture.test.ts` and `tests/hooks/cursor/kb-capture.test.ts` receive the same updates
- [ ] `tests/init.test.ts` drops the assertion about `.secretlintrc.json` not being produced (approximately line 161)
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `grep -r "secret-scan\|secretlint\|secret_scan" tests/` returns zero matches (except archived fixture paths if any)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Vitest test runner (`npm test`)
- Hook tests may execute compiled bundles under `dist/hooks/` — ensure Task 1's build ran first
- Do not add tests for third-party secretlint behavior; only adjust tests for this project's capture logic

## Input Dependencies
- Task 1: source removal and rebuild must be complete so types, hooks, and bundles match the new behavior

## Output Artifacts
- Deleted: `tests/lib/secret-scan.test.ts`
- Modified: `tests/lib/capture.test.ts`, `tests/lib/memory-files.test.ts`, `tests/hooks/kb-capture.test.ts`, `tests/hooks/codex/kb-capture.test.ts`, `tests/hooks/cursor/kb-capture.test.ts`, `tests/init.test.ts`

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
- Trivial getters/setters or static configuration
- Obvious functionality that would break immediately if incorrect

<details>
<summary>Step-by-step</summary>

1. Delete `tests/lib/secret-scan.test.ts` entirely.
2. In `tests/lib/capture.test.ts`:
   - Remove the `fakeScanner` helper and any tests asserting `secret-scan-blocked`.
   - Simplify tests that passed a scanner into `CaptureContext` — they should call capture without scan fields.
   - Keep tests that verify successful capture and session log rendering.
3. In `tests/lib/memory-files.test.ts`:
   - Remove tests for secretlint-blocked and secretlint-redacted paths.
   - Remove scanner setup from remaining tests; assert memory file content is used as-is.
4. In `tests/hooks/kb-capture.test.ts`:
   - Replace assertions like "secretlint finds no secrets" with straightforward capture-success checks.
5. Apply the same hook test simplifications in `tests/hooks/codex/kb-capture.test.ts` and `tests/hooks/cursor/kb-capture.test.ts`.
6. In `tests/init.test.ts`, remove the `.secretlintrc.json` assertion (approximately line 161).
7. Grep `tests/` for stale references: `secret-scan`, `secretlint`, `secret_scan`, `fakeScanner`, `scanText`. Clean up any remaining hits.
8. Run `npm test` and `npm run typecheck`; fix failures.
9. Optionally smoke-test capture manually per plan self-validation:
   ```bash
   echo '{"session_id":"test-removal","transcript_path":"/tmp/test.jsonl","hook_event_name":"Stop","cwd":"/workspace"}' | node dist/hooks/claude/kb-capture.cjs
   ```
   Confirm a session log is written when given a valid synthetic payload.

</details>
