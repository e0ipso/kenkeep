---
id: 1
group: "prompt-eval-judge-relocation"
dependencies: []
status: "completed"
created: 2026-07-28
skills:
  - typescript
complexity_score: 3
execution_profile: "standard-implementation"
---
# Relocate prompt-eval-judge.md and update its default read paths

## Objective
Move `src/templates-source/prompts/prompt-eval-judge.md` out of the template
source tree entirely, into the dev-only location
`scripts/prompt-eval/prompt-eval-judge.md` (alongside the maintainer script
that owns it), and update the two hardcoded default paths that currently
point at the old build-artifact location so the maintainer evaluator keeps
working unchanged from a source checkout.

## Skills Required
TypeScript — editing two `.ts` files' string literal defaults, plus a plain
file move that preserves content and git history.

## Acceptance Criteria
- [ ] `src/templates-source/prompts/prompt-eval-judge.md` no longer exists on disk.
- [ ] `scripts/prompt-eval/prompt-eval-judge.md` exists with byte-identical content to the original file (verify with `git mv`, not copy+delete).
- [ ] `src/commands/prompt-eval.ts`'s default for `judgePromptFile` (currently `opts.judgePromptFile ?? 'templates/prompts/prompt-eval-judge.md'` at line ~238) now reads `opts.judgePromptFile ?? 'scripts/prompt-eval/prompt-eval-judge.md'`.
- [ ] `scripts/prompt-eval/run.ts`'s Commander `--judge-prompt-file` option default (currently `'templates/prompts/prompt-eval-judge.md'` at line ~28) now reads `'scripts/prompt-eval/prompt-eval-judge.md'`.
- [ ] Running `grep -rn "templates/prompts/prompt-eval-judge.md" src/ scripts/` returns no results.
- [ ] The `--prompt-file` default (`templates/prompts/proposal-extract.md`) in both files is left untouched — only the judge-prompt path changes.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Repo root: `/workspace`.
- `src/commands/prompt-eval.ts` around line 236-239:
  ```ts
  const judgePromptFile = resolve(
    root,
    opts.judgePromptFile ?? 'templates/prompts/prompt-eval-judge.md'
  );
  ```
  Change only the string literal to `'scripts/prompt-eval/prompt-eval-judge.md'`. `resolve(root, ...)` already resolves relative to the repo root, so the new relative path is correct as-is.
- `scripts/prompt-eval/run.ts` around line 25-29:
  ```ts
  .option(
    '--judge-prompt-file <path>',
    'built semantic judge prompt',
    'templates/prompts/prompt-eval-judge.md'
  )
  ```
  Change only the default string literal (3rd argument) to `'scripts/prompt-eval/prompt-eval-judge.md'`. Do not change the option's help text unless it becomes misleading (the phrase "built semantic judge prompt" is no longer accurate since the file is read directly from source, not from a build artifact — update it to something like `'semantic judge prompt (dev-only, read directly from source)'`).

## Input Dependencies
None. This task only reads the plan and current source tree.

## Output Artifacts
- Relocated file at `scripts/prompt-eval/prompt-eval-judge.md`.
- Updated default paths in `src/commands/prompt-eval.ts` and `scripts/prompt-eval/run.ts`.

These are consumed by Task 3 (end-to-end verification, which runs `npm run prompt-eval` and confirms `build:templates` no longer produces the old file) and inform Task 2 (documentation updates referencing the same new path).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. From the repo root, move the file with `git mv src/templates-source/prompts/prompt-eval-judge.md scripts/prompt-eval/prompt-eval-judge.md`. Do not use `cp` followed by `rm` — `git mv` preserves file history in a single operation and guarantees no stray copy is left behind (this is the exact failure mode the plan's Implementation Risks section calls out: "Partial move leaves two copies").
2. Do not edit the moved file's content. Its `Version:` header and body are unaffected by the move — only its location changes.
3. Edit `src/commands/prompt-eval.ts`: update the `judgePromptFile` default string literal only.
4. Edit `scripts/prompt-eval/run.ts`: update the `--judge-prompt-file` option's default string literal (and optionally its help text, per Technical Requirements above).
5. Confirm no other file references the old path: `grep -rn "templates/prompts/prompt-eval-judge.md" src/ scripts/` must return nothing. (A separate grep across `docs/` is Task 2's responsibility; a full-repo grep across everything including docs is Task 3's responsibility.)
6. Do not touch `scripts/build-templates.mjs` or `src/commands/init.ts` — per the plan, no exclusion logic is needed anywhere; the file simply stops being picked up by the existing tree-copy logic once it no longer lives under `src/templates-source/`.

</details>
