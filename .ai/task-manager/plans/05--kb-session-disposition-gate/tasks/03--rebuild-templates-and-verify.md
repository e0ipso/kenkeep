---
id: 3
group: "build-and-verify"
dependencies: [1, 2]
status: "completed"
created: 2026-05-13
skills:
  - bash
---
# Rebuild templates and verify shipped artifact matches source

## Objective

Run `npm run build:templates` to regenerate the shipped prompt artifacts under `templates/prompts/`, then verify by direct file diff that `templates/prompts/proposal-extract.md` and `templates/prompts/curator.md` reflect the source edits from tasks 1 and 2 verbatim. Because `templates/` is gitignored, `git diff` will not show the artifact update; a direct `diff` between source and shipped is the substantive verification, matching the precedent plan 03 set.

## Skills Required

- bash: run the build script, run the validation greps and diffs, and read their output to confirm the success-criteria checks pass.

## Acceptance Criteria

- [ ] `npm run build:templates` completes without error.
- [ ] `diff src/templates-source/prompts/proposal-extract.md templates/prompts/proposal-extract.md` produces no output (the files are identical).
- [ ] `diff src/templates-source/prompts/curator.md templates/prompts/curator.md` produces no output (the files are identical).
- [ ] `grep -nE "session disposition|non-productive|abandoned|exploratory|cursory|unrelated|meta-only" src/templates-source/prompts/proposal-extract.md` shows hits for every gate concept: the term "session disposition", the modifier "non-productive", and each of the five shape names.
- [ ] `grep -nE "non-productive|hedged|hypothetical|plan-scoped" src/templates-source/prompts/curator.md` shows the new drop reason and at least three of the candidate-visible signals.
- [ ] `grep -nE "session disposition|non-productive" src/templates-source/prompts/proposal-extract.md src/templates-source/prompts/curator.md` matches both files for both terms (the cross-file vocabulary alignment).
- [ ] `grep -nE " - |—|–" src/templates-source/prompts/proposal-extract.md src/templates-source/prompts/curator.md` shows no matches inside new instructional prose. Matches inside example transcripts that quote user or agent text verbatim are acceptable; the reviewer notes which matches are quoted versus instructional in the task completion summary.
- [ ] The inline meta-only worked example in `proposal-extract.md` is present, shows a plan-authoring or task-shaped conversation, has expected output `{"practice": [], "map": []}`, and commentary that names the false-positive failure mode the example inoculates against.
- [ ] No git-tracked file under `templates/` changes (the directory is gitignored; `git status` should show no entries beneath it).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Node toolchain sufficient to run `npm run build:templates`.
- Working directory: the repository root.
- The build script is `scripts/build-templates.mjs`; it wipes `templates/` and rebuilds it from `src/templates-source/` and `dist/hooks/`. The prompt files copy through verbatim.
- `templates/` is gitignored per `practice-do-not-commit-bundled-output`; do not stage anything under `templates/`.

## Input Dependencies

- Task 1: `src/templates-source/prompts/proposal-extract.md` edits landed.
- Task 2: `src/templates-source/prompts/curator.md` and `docs/internals/prompts.md` edits landed.

## Output Artifacts

- Regenerated `templates/prompts/proposal-extract.md` and `templates/prompts/curator.md` (gitignored).
- A short completion summary listing the validation commands run and their results.

## Implementation Notes

<details>
<summary>Step-by-step verification guidance</summary>

1. **Confirm preconditions.** Both task 1 and task 2 are completed; the source files under `src/templates-source/prompts/` contain the new content. Read the head and tail of each prompt source to spot-check.

2. **Run the build.**
   ```
   npm run build:templates
   ```
   The script wipes `templates/` and rebuilds it. Confirm the command exits with status 0 and produces no error output.

3. **Diff source against shipped.**
   ```
   diff src/templates-source/prompts/proposal-extract.md templates/prompts/proposal-extract.md
   diff src/templates-source/prompts/curator.md templates/prompts/curator.md
   ```
   Both diffs are empty. Any non-empty diff is a failure; investigate whether the build was skipped, whether the script transforms the prompt content (it should not for prompts), or whether the wrong source file was edited.

4. **Run the success-criteria greps.**
   ```
   grep -nE "session disposition|non-productive|abandoned|exploratory|cursory|unrelated|meta-only" src/templates-source/prompts/proposal-extract.md
   grep -nE "non-productive|hedged|hypothetical|plan-scoped" src/templates-source/prompts/curator.md
   grep -nE "session disposition|non-productive" src/templates-source/prompts/proposal-extract.md src/templates-source/prompts/curator.md
   grep -nE "non-productive|abandoned|exploratory|cursory|unrelated|meta-only" docs/internals/prompts.md
   ```
   Confirm each grep yields the expected hits documented in tasks 1 and 2.

5. **Run the prose-convention grep.**
   ```
   grep -nE " - |—|–" src/templates-source/prompts/proposal-extract.md src/templates-source/prompts/curator.md docs/internals/prompts.md
   ```
   Inspect each hit. Matches inside transcript-style example bodies that quote user or agent text verbatim are acceptable; matches in new instructional prose are not. Note in the completion summary which matches are quoted versus instructional. If any instructional-prose match exists, fix it in source, rerun the build, and rerun this grep.

6. **Inspect the new inline example.** Open `src/templates-source/prompts/proposal-extract.md` and locate the new meta-only worked example block. Confirm:
   - The transcript reads as a plan-authoring or task-shaped conversation.
   - The expected output is `{"practice": [], "map": []}`.
   - The commentary names the false-positive failure mode the example inoculates against (phantom conventions extracted from planning sessions).

7. **Confirm gitignore behaviour.**
   ```
   git status --short templates/
   ```
   The output is empty. If anything under `templates/` appears in `git status`, `templates/` is no longer gitignored and the precondition recorded in `practice-do-not-commit-bundled-output` is violated; do not stage these files, surface the gitignore regression instead.

8. **Optional fixture run.** If a synthetic session log of an exploratory or planning conversation is available locally, run `ai-knowledge-base curate` against it and confirm the extractor emits an empty proposal and the curator records no actions. This step is optional and only runs locally with a working Claude CLI; skip cleanly if unavailable, do not block the task on it.

9. **Completion summary.** Record in the task completion message: the build exit status, both diff outputs (should be empty), the four grep results, the prose-convention grep results with quoted-versus-instructional annotations, and confirmation that `git status templates/` is empty.

</details>
