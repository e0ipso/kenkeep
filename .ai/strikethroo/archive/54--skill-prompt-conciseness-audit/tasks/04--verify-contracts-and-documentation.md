---
id: 4
group: "verification"
dependencies: [2, 3]
status: "completed"
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

## Verification Results

| File | baseline → post (lines) |
|---|---|
| kk-add | 128 → 73 |
| kk-bootstrap | 282 → 227 |
| kk-curate (+ batch-agent-prompt 16) | 560 → 423 |
| kk-migrate | 182 → 127 |
| kk-session-extract | 167 → 112 |
| proposal-extract.md | 295 → 287 |
| st-execute-task | 195 → 184 |
| st-full-workflow | 413 → 93 |
| st-refine-plan | 205 → 196 |

- **Forbidden phrases** (`-p mode`, `reference runtime`, `byte-equivalent`, `Plan 44`) across `src/templates-source`, `.claude/.agents/.cursor/.opencode/skills`, `.ai/kenkeep/.config/prompts`: **none**.
- **Expected references present**: `kk-detect-harness` in the 5 kk skills + the shared helper; `batch-agent-prompt` in `kk-curate` across all mirrors; the `batch-agent-prompt.md` file exists in source, `templates/skills`, and all four installed mirrors (16 lines each).
- **`npm run build:templates`**: regenerated `templates/` is clean against committed output (no hand-edits).
- **`npm run lint:detect-harness`**: OK (detector source matches TS adapters).
- **Byte-equality**: every present kk skill file (and `batch-agent-prompt.md`) in `.claude/.agents/.cursor/.opencode/skills` and `templates/skills` is byte-identical to the canonical source via `cmp` — the pre-existing `.cursor` 1-line drift is now resolved. The shared detector is byte-identical across source, `templates/kenkeep/scripts`, and the `.ai/kenkeep/scripts` dogfood copy.
- **Schema contract** (`src/lib/schemas.ts`): action enum `add|modify|contradict|drop`, `candidate_origin`, nullable `target_node_id`/`proposed_node`, optional-nullable `home_folder`, optional `depends_on` (default `[]`), `.strict()`, and **no** `suggested_resolution`. kk-curate prose still documents `home_folder` and `depends_on`; the only legacy-key mention in the prompt is the negative "wrapper rejects" note.
- **Init/upgrade coverage**: `tests/init.test.ts` and `tests/upgrade.test.ts` assert the new `.ai/kenkeep/scripts/kk-detect-harness.mjs` reference and helper install (incl. copy-if-missing + no-overwrite on upgrade).
- **Documentation**: `CHANGELOG.md` `## Unreleased` gained entries for the proposal-extract Version 2 bump, the kk skill condensation/version bumps, and the shared-detector extraction (the repo's hand-maintained Unreleased block; `refactor` commits do not surface in semantic-release auto-notes, so the human note is required).
- **Gates**: `npm run lint` ✅, `npm run typecheck` ✅, `npm test` ✅ (378 tests, run via the per-phase pre-commit hook).

### Noteworthy
- Three knowledge-base nodes still reference the removed `/tmp/kk-detect-harness.mjs` heredoc: `.ai/kenkeep/nodes/harnesses/map-harness-adapter.md`, `.ai/kenkeep/nodes/harnesses/practice-explicit-harness-flag-outside-claude.md`, `.ai/kenkeep/nodes/bootstrap/map-kk-bootstrap-skill.md`. Per the constitution, KB nodes are human-curated (`/kk-curate` + commit), so these are **flagged for a follow-up curation pass**, not edited by this plan.
- `kk-session-extract` carried the same detection heredoc as the four named skills; it was included in the detector-extraction-only swap (no version bump) to avoid leaving duplicated/divergent code.
