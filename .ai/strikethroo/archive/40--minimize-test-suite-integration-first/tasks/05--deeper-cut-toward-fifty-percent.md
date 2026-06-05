---
id: 5
group: "test-suite-minimization"
dependencies: [4]
status: "completed"
created: 2026-06-05
skills:
  - vitest
  - typescript
complexity_score: 6
complexity_notes: "Remediation pass authorized by the user after the 50 percent gate miss; cuts deeper across the whole suite at an explicit coverage cost, bounded only by the AGENTS.md per-adapter rule and a green suite."
---
# Deeper cut toward a 50 percent reduction

## Objective
The user explicitly authorized losing some integration and pure-logic coverage to approach a 50 percent case reduction (the prior phases stopped at ~27 percent to protect the floor). Reduce the suite from 322 toward ~220 cases (about 50 percent of the 440 baseline), accepting coverage loss, while keeping the suite green and not violating the one hard project rule below.

## Skills Required
- `vitest`: aggressive but coherent consolidation across the whole suite.
- `typescript`: keep imports/types valid after cuts.

## Acceptance Criteria
- [ ] Final `npx vitest run` is green and reports approximately 220 tests (a >=50 percent reduction from 440). If the AGENTS.md rule below prevents reaching exactly 220, get as close as possible and report the binding constraint.
- [ ] The AGENTS.md four-area per-adapter rule is NOT violated: every registered adapter (claude, codex, copilot, cursor, opencode) still has at least one asserting case for transcript parsing, hooks-config registration (where the adapter has a writer), headless option mapping (where applicable), and doctor checks.
- [ ] Every CLI command and every hook pipeline still has at least one asserting test (one assertion is acceptable now).
- [ ] `npm run typecheck` passes.
- [ ] No changes outside `tests/` and AGENTS.md; `src/` and `dist/` untouched.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Suggested cut budget (vitest-expanded counts), adjust as needed to land near 220:
  - Pure-logic units: `tests/harnesses/detect.test.ts` 21 -> ~8, `tests/harnesses/registry.test.ts` 19 -> ~8, `tests/lib/json-extract.test.ts` 15 -> ~6, `tests/lib/nodes.test.ts` 10 -> ~5.
  - Parametrized adapter tests: reduce to roughly one representative case per adapter per area: `transcript` 20 -> ~10, `headless` 17 -> ~9, `hooks-config` 18 -> ~9, `list-memory-files` 15 -> ~8 (keep every adapter represented).
  - Within-suite redundancy: `init` 22 -> ~13, plus minor trims to doctor/upgrade/bootstrap/settings/session-start and the command suites where cases overlap.
- Test runner: `npx vitest run`. claude subprocess is mocked.
- Project style: NO em dashes; no trailing whitespace; newline at EOF.

## Input Dependencies
- Task 4 completed; suite green at 35 files / 322 tests.

## Output Artifacts
- A ~220-case green suite and a report of what was cut and the final count.

## Implementation Notes

<details>
<summary>Guidance</summary>

This is a deliberate, user-approved coverage reduction. Prefer cutting: redundant variants of the same assertion, granular boundary cases, cosmetic/wording assertions, and duplicate scenarios across the parametrized adapter matrices. Keep: at least one assertion per command, per hook, and per adapter-area (AGENTS.md). When two cases prove the same thing, keep the stronger one. Do not delete an entire command/hook/adapter-area's only coverage. Keep the suite green after every group of deletions; run `npx vitest run` frequently.
</details>
