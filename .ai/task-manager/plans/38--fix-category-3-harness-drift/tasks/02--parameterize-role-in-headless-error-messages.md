---
id: 2
group: "headless-error-messages"
dependencies: []
status: completed
created: 2026-05-26
skills:
  - typescript
---
# Parameterize Role in Headless Error Messages

## Objective
Replace hardcoded "curator" and "proposal" strings in headless error messages across all 4 harness adapters with a parameterized role name, so errors accurately reflect which role (curator, proposal, or bootstrap) failed.

## Skills Required
- TypeScript: modifying function signatures and string interpolation in harness adapter files

## Acceptance Criteria
- [ ] `src/harnesses/claude/headless.ts` `runHeadlessClaude` accepts a `role` parameter and uses it in error messages instead of hardcoded "curator"/"proposal"
- [ ] `src/harnesses/codex/headless.ts` `runHeadlessCodex` accepts a `role` parameter and uses it in error messages instead of hardcoded "curator"/"proposal"
- [ ] `src/harnesses/cursor/headless.ts` `runHeadlessCursor` accepts a `role` parameter and uses it in error messages instead of hardcoded "curator"/"proposal"
- [ ] `src/harnesses/opencode/headless.ts` `runHeadlessOpenCode` accepts a `role` parameter and uses it in error messages
- [ ] All call sites of these functions are updated to pass the correct role name
- [ ] All existing tests pass (`npx vitest run`)
- [ ] `grep -rn '"curator output"' src/harnesses/` returns zero matches

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Add a `role: string` parameter to each headless function's signature
- Replace hardcoded role strings in error messages with template literal interpolation
- Update all callers to pass the appropriate role string

## Input Dependencies
None — these are independent fixes to headless adapter files.

## Output Artifacts
- Modified `src/harnesses/claude/headless.ts`
- Modified `src/harnesses/codex/headless.ts`
- Modified `src/harnesses/cursor/headless.ts`
- Modified `src/harnesses/opencode/headless.ts`
- Modified call sites (find via `grep -rn 'runHeadlessClaude\|runHeadlessCodex\|runHeadlessCursor\|runHeadlessOpenCode' src/`)

## Implementation Notes
<details>

**Step 1: Identify all call sites first.**

Run:
```bash
grep -rn 'runHeadlessClaude\|runHeadlessCodex\|runHeadlessCursor\|runHeadlessOpenCode' src/ --include='*.ts'
```

This reveals every caller so you know which role string to pass at each site.

**Step 2: Modify each headless function.**

For Claude (`src/harnesses/claude/headless.ts`), Codex (`src/harnesses/codex/headless.ts`), and Cursor (`src/harnesses/cursor/headless.ts`), the pattern is the same. Add `role: string` parameter and replace:

- `"curator output was not valid JSON: ..."` → `` `${role} output was not valid JSON: ...` ``
- `"proposal output did not match schema: ..."` → `` `${role} output did not match schema: ...` ``

For OpenCode (`src/harnesses/opencode/headless.ts`), replace:

- `"Could not parse opencode output as JSON: ..."` → `` `${role} output was not valid JSON: ...` `` (or a consistent pattern)
- `"opencode output did not match schema: ..."` → `` `${role} output did not match schema: ...` ``

**Step 3: Update all callers** to pass the role name string (e.g., `'curator'`, `'proposal'`, `'bootstrap'`).

**Verification**: Run `npx vitest run` and `grep -rn '"curator output"' src/harnesses/` (should return zero matches).

</details>
