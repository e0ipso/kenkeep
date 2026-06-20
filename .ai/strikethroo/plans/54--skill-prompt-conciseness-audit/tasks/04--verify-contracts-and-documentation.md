---
id: 4
group: "verification"
dependencies: [2, 3]
status: "pending"
created: 2026-06-20
skills:
  - verification
  - nodejs-tooling
complexity_score: 6
complexity_notes: "Verification spans line counts, grep/diff checks, prompt documentation obligations, and the repository's Node-based quality gates."
---
# Verify Contracts and Documentation

## Objective
Validate that the conciseness pass preserved behavior contracts, synchronized mirrors, removed forbidden prose, and satisfied prompt/template documentation obligations.

## Skills Required
Use `verification` for contract review, grep/diff checks, and top-to-bottom file review. Use `nodejs-tooling` for repository lint/type/test commands when appropriate.

## Acceptance Criteria
- [ ] Post-edit `wc -l` counts are captured and compared with the initial snapshot from task 1.
- [ ] Every rewritten file is reviewed top-to-bottom against the baseline checklist from task 1.
- [ ] Grep checks find no remaining `-p mode`, `reference runtime`, `byte-equivalent`, or `Plan 44` references in edited scope.
- [ ] Grep checks confirm expected `kk-detect-harness` and `batch-agent-prompt` references/files exist.
- [ ] `npm run build:templates` has refreshed generated `templates/` from source, and the generated diff is inspected rather than hand-edited.
- [ ] `npm run lint:detect-harness` passes after the detector extraction.
- [ ] Canonical kk skill files, generated `templates/skills/kk-*`, and installed kk skill files are compared with `diff -u` or `cmp`, and any required equality is restored.
- [ ] Current curator schema fields are verified against `src/lib/schemas.ts`, including `home_folder`, optional `depends_on`, and no stale `suggested_resolution`.
- [ ] If `.ai/kenkeep/scripts/kk-detect-harness.mjs` is used, init/upgrade coverage verifies the helper is installed for new and existing repos.
- [ ] Relevant documentation, changelog, or release-note obligations from prompt versioning/template-source changes are completed or explicitly documented.
- [ ] `npm run lint`, `npm run typecheck`, and `npm test` are run unless a narrower docs-only validation is explicitly justified.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use the exact validation commands listed in plan 54 where possible, adapted to skip non-existent harness skill directories instead of failing on missing paths. Do not run `curate` or `bootstrap` as part of verification. Do not hand-edit generated `templates/` output.

## Input Dependencies
Requires completed kk/prompt edits from task 2 and Strikethroo skill edits from task 3.

## Output Artifacts
- Verification command results.
- Any final documentation or changelog update required by prompt/version changes.
- Final implementation summary suitable for a PR description.
- Notes on any intentionally skipped validation, including the reason and residual risk.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Run `wc -l` on the scoped files and compare the results to task 1's pre-edit counts.
2. Read the rewritten files top-to-bottom, checking that each baseline contract item survived. Include `home_folder`, optional `depends_on`, `--folder`, `--source-doc` / `--source-hash` omission in curate persistence, conflict token outcomes, and final Strikethroo summary blocks.
3. Run `npm run build:templates`. Inspect `git diff -- templates/` to ensure generated files mirror `src/templates-source/` changes and were not manually edited.
4. Run `npm run lint:detect-harness` before broad linting so detector extraction failures are isolated.
5. Run forbidden-phrase checks over existing paths. Build the path list from directories that exist in the checkout, for example `src/templates-source`, `.claude/skills`, `.agents/skills`, `.cursor/skills`, `.opencode/skills`, `.github/skills` if present, and `.ai/kenkeep/.config/prompts`:
   ```sh
   rg -- '-p mode|reference runtime|byte-equivalent|Plan 44' <existing-paths>
   rg 'kk-detect-harness|batch-agent-prompt' <existing-paths>
   ```
6. Compare shared kk files across:
   - `src/templates-source/skills/kk-*`
   - `templates/skills/kk-*`
   - installed `.claude/skills/kk-*`, `.agents/skills/kk-*`, `.cursor/skills/kk-*`, `.opencode/skills/kk-*`, and `.github/skills/kk-*` when present
   Include any new sibling prompt file.
7. If `.ai/kenkeep/scripts/kk-detect-harness.mjs` is the chosen helper path, verify both package skeleton and upgrade behavior. Prefer automated coverage in `tests/init.test.ts` and `tests/upgrade.test.ts`; otherwise document a manual sandbox validation.
8. If `proposal-extract.md` or kk skill version comments changed, update `CHANGELOG.md` under Unreleased or capture the exact release-note requirement if the maintainer has a different convention.
9. Run `npm run lint`, `npm run typecheck`, and `npm test` unless the final diff is demonstrably docs-only and the maintainer has accepted narrower validation.

Test philosophy for this plan: meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. Favor integration and critical-path coverage over per-method unit tests. Because this plan is primarily a markdown skill/prompt refactor, focused contract checks and existing repository quality gates are more valuable than adding new tests unless helper script behavior changes materially.

</details>
