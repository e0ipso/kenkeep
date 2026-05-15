---
id: 9
group: "skills-consolidation"
dependencies: [3, 8]
status: "completed"
created: 2026-05-15
skills:
  - node
  - ci-cd
---

# CI lint that fails on drift between detect.ts and the SKILL.md heredoc

## Objective

Add `scripts/lint-detect-harness.mjs`. The script extracts the detect-harness heredoc body from `src/templates-source/skills/kb-curate/SKILL.md`, parses both the heredoc and `src/harnesses/detect.ts` for their env-var detector lists and registered harness id list, and exits non-zero when the two sets diverge. Wire it into the npm scripts and the existing CI workflow.

## Skills Required

- node
- ci-cd

## Acceptance Criteria

- [ ] `scripts/lint-detect-harness.mjs` exists and is executable as `node scripts/lint-detect-harness.mjs`
- [ ] Script extracts the heredoc body using a regex anchored on `cat << 'EOF' > /tmp/kb-detect-harness.mjs` and the closing `EOF`
- [ ] Script extracts env-var detectors from `src/harnesses/detect.ts` (the list of `{ env: '<VAR>', value: '<VAL>', harness: '<id>' }` tuples or equivalent representation that `resolveWithHint` consumes)
- [ ] Script extracts the same set from the heredoc body (regex over the script's env-check block)
- [ ] Script extracts the registered harness id list from each side
- [ ] Script exits 0 when both sets match and non-zero with a precise mismatch diff message when they don't
- [ ] `package.json` adds an npm script entry, e.g. `"lint:detect-harness": "node scripts/lint-detect-harness.mjs"`
- [ ] CI workflow runs the new script as part of `npm run lint` or as a dedicated step
- [ ] Negative test: temporarily add a fake env detector to `detect.ts`, run the lint, observe non-zero exit with a useful message; revert
- [ ] `npm run lint` (or whatever umbrella script CI uses) passes on the green build

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `scripts/lint-detect-harness.mjs`
- `package.json` script entry
- CI workflow file under `.github/workflows/` (extend the existing build/test workflow; do not create a new one)

## Input Dependencies

- Task 3 (`detect.ts` has the canonical env-var list and `resolveWithHint`)
- Task 8 (`src/templates-source/skills/kb-curate/SKILL.md` has the heredoc body)

## Output Artifacts

- CI guardrail catching drift between the two source-of-truth files

## Implementation Notes

<details>
<summary>Guidance</summary>

- Keep the extraction parsers narrow. Don't bring in a JS/TS parser dependency; regex is sufficient because both files have well-defined shapes:
  - `detect.ts` env tuples: scan for a string-literal pattern like `{ env: '...', value: '...', harness: '...' }` inside a known exported array.
  - Heredoc env checks: scan for `process.env['<VAR>'] === '<VAL>'` or `process.env.<VAR> === '<VAL>'` patterns.
- Compare the harness id list (`['claude', 'codex', 'opencode']` today) verbatim. The lint fails if either side adds or drops an id without the other being updated.
- Failure message must name both files and show the diff (set-symmetric-difference printed as `+ added` / `- missing`).
- Per `feedback_hide_cosmetic_shell_errors`: when the lint passes, output `detect-harness lint OK` and exit silently; only print noise on failure.

</details>
