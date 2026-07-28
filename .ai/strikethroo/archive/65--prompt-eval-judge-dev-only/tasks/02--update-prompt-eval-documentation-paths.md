---
id: 2
group: "prompt-eval-judge-relocation"
dependencies: []
status: "completed"
created: 2026-07-28
skills:
  - technical-writing
complexity_score: 2
execution_profile: "docs-and-config"
---
# Update documentation to reference the new prompt-eval-judge.md location

## Objective
Update `docs/internals/prompt-eval.md` and `docs/internals/prompts.md` so
neither references the old `templates/prompts/prompt-eval-judge.md`
build-artifact path, and the prompt inventory table in `prompts.md` clearly
states the file's new dev-only location relative to the source tree.

## Skills Required
Technical writing — Markdown doc edits, no code changes.

## Acceptance Criteria
- [ ] `docs/internals/prompt-eval.md` line ~73's `--judge-prompt-file` example uses `scripts/prompt-eval/prompt-eval-judge.md` instead of `templates/prompts/prompt-eval-judge.md`.
- [ ] `docs/internals/prompts.md`'s `prompt-eval-judge.md` row (in the "Where each prompt lives" table, ~line 23) explicitly states the file lives at `scripts/prompt-eval/prompt-eval-judge.md`, distinguishing it from the other rows in that table which are template-sourced and distributed to consumers.
- [ ] Running `grep -rn "templates/prompts/prompt-eval-judge.md" docs/` returns no results.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `docs/internals/prompt-eval.md`, in the "Useful path overrides" example block (~line 70-75):
  ```sh
  npm run prompt-eval -- --harness <id> \
    --fixtures-dir tests/fixtures/prompt-eval \
    --prompt-file templates/prompts/proposal-extract.md \
    --judge-prompt-file templates/prompts/prompt-eval-judge.md \
    --output-dir .ai/kenkeep/.state/prompt-eval/my-run
  ```
  Change only the `--judge-prompt-file` line's value to `scripts/prompt-eval/prompt-eval-judge.md`. Leave `--prompt-file templates/prompts/proposal-extract.md` unchanged — `proposal-extract.md` is a genuinely distributed template and its build-artifact path is still correct.
- `docs/internals/prompts.md`, in the "Where each prompt lives" table (~line 20-29), the current row is:
  ```
  | **`prompt-eval-judge.md`** | Source-repository-only semantic verifier for proposal-evaluation facets. The explicit maintainer evaluator runs it through the same selected harness in a fresh isolated call. |
  ```
  This row already correctly describes the file as source-repository-only, but does not state where it lives. Extend the description to name its path, e.g.: "Lives at `scripts/prompt-eval/prompt-eval-judge.md` (not under `src/templates-source/`, so it is never copied into `templates/` or a consumer's `.ai/kenkeep/.config/prompts/`). Source-repository-only semantic verifier for proposal-evaluation facets. The explicit maintainer evaluator runs it through the same selected harness in a fresh isolated call."
  Note: `prompts.md` has no other literal references to the old path elsewhere in the file (confirmed by repo-wide grep during plan authoring); do not search for or alter unrelated rows.

## Input Dependencies
None — the new target path (`scripts/prompt-eval/prompt-eval-judge.md`) is fully specified by the plan and does not require Task 1 to have completed first, since this task only edits prose.

## Output Artifacts
Updated `docs/internals/prompt-eval.md` and `docs/internals/prompts.md`, consumed by Task 3's repo-wide grep verification.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Edit `docs/internals/prompt-eval.md`: change only the `--judge-prompt-file` value in the example command block.
2. Edit `docs/internals/prompts.md`: extend the `prompt-eval-judge.md` row's description to name the new path, as shown in Technical Requirements. Keep the existing sentences about it being source-repository-only and run by the maintainer evaluator — only add the location detail, do not remove existing accurate content.
3. Run `grep -rn "templates/prompts/prompt-eval-judge.md" docs/` and confirm it returns nothing before marking this task complete.
4. Do not touch any other prompt's documentation — `proposal-extract.md`, `knowledge-admission.md`, and `sub-agent-delegation.md` remain genuinely consumer-facing and their documented paths are unaffected by this plan.

</details>
