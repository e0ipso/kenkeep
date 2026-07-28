---
id: 3
group: "prompt-eval-judge-relocation"
dependencies: [1, 2]
status: "completed"
created: 2026-07-28
skills:
  - build-verification
complexity_score: 4
execution_profile: "standard-implementation"
---
# Verify prompt-eval-judge.md is fully relocated and no longer distributed

## Objective
Prove, with concrete runnable commands, that `prompt-eval-judge.md` is fully
relocated: no stale references remain anywhere in the repo, a clean
`build:templates` run no longer produces it, the maintainer evaluator still
runs successfully from its new default path, typecheck/tests stay green, and
a fresh `init` / `init --upgrade` no longer distributes it to a consumer
project.

## Skills Required
Build verification — running existing npm scripts and the built CLI, and
inspecting their output/exit codes/produced files. No source code changes
are expected in this task; if any of the verification steps fail, that is a
signal Task 1 or Task 2 was incomplete and must be revisited, not something
to patch around here.

## Acceptance Criteria
- [ ] `grep -rn "prompt-eval-judge" src/ scripts/ tests/ docs/ package.json .github/` returns only hits that point at the new dev-only path `scripts/prompt-eval/prompt-eval-judge.md` (or are the file's own content) — no hit references `src/templates-source/prompts/prompt-eval-judge.md` or `templates/prompts/prompt-eval-judge.md`.
- [ ] `npm run build:templates` completes successfully, and `find templates -iname "prompt-eval*"` afterward returns no results.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0, and no test (e.g. `tests/prompt-eval-runner.test.ts`, if present) references the old `templates/prompts/prompt-eval-judge.md` path.
- [ ] `npm run prompt-eval -- --harness <a locally available harness id>` completes and produces a Markdown report (exit code reflects only fixture pass/fail status per the tool's own documented behavior, not an execution error), proving the relocated judge prompt is read correctly from its new default path.
- [ ] In a scratch temp directory outside the repo, running the built CLI's `init` (fresh project) and separately `init --upgrade` (against a pre-seeded fake prior install) both populate `.ai/kenkeep/.config/prompts/` with exactly `proposal-extract.md`, `knowledge-admission.md`, and `sub-agent-delegation.md` — no `prompt-eval-judge.md`.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Repo root: `/workspace`. Run all `npm run` commands from there.
- The harness for `npm run prompt-eval` must be one of `claude`, `codex`, `copilot`, `cursor`, or `opencode`, and must be installed/authenticated in this environment; pick whichever is available. If none is available, record that as a blocker rather than skipping the check silently.
- For the scratch `init` / `init --upgrade` check: build the CLI first (`npm run build`), then invoke the built entrypoint against an empty temp directory for `init`, and against a temp directory pre-seeded with a prior install's `.ai/kenkeep/` structure for `init --upgrade`. Inspect `.ai/kenkeep/.config/prompts/` after each run.

## Input Dependencies
Requires Task 1 (file relocated, default paths updated) and Task 2
(documentation updated) to be complete — this task's grep and behavioral
checks are only meaningful once both prior tasks have landed.

## Output Artifacts
A verification record (command outputs / exit codes) confirming every
Success Criterion and Self Validation step in the plan document is
satisfied. No new source files are produced.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Run the repo-wide grep first — it's the cheapest check and catches any leftover reference immediately:
   `grep -rn "prompt-eval-judge" src/ scripts/ tests/ docs/ package.json .github/`
   Inspect every hit. Acceptable hits: `scripts/prompt-eval/prompt-eval-judge.md` itself (the file's own content/header), and any source line that now reads the new path. Unacceptable: any occurrence of `src/templates-source/prompts/prompt-eval-judge.md` or `templates/prompts/prompt-eval-judge.md`.
2. Run `npm run build:templates`, then `find templates -iname "prompt-eval*"`. The command must return no results — this is the direct proof that the relocation removes the file from the published build output, per the plan's primary success criteria.
3. Run `npm run typecheck` and `npm test`. Both must exit 0. If `tests/prompt-eval-runner.test.ts` or any other test file hardcodes the old path, that is a stale reference Task 1 missed — flag it and treat this task as blocked pending a fix, do not edit test expectations to mask it.
4. Run `npm run prompt-eval -- --harness <id>` (substitute an available harness). Confirm it completes and writes a report under `.ai/kenkeep/.state/prompt-eval/`. A nonzero exit here means the evaluator itself failed to execute (e.g., couldn't find the judge prompt at its new default path) — per `docs/internals/prompt-eval.md`, fixture pass/fail is advisory and does not affect exit code, but an execution failure does, so a nonzero exit is a real signal something in Task 1 is wrong.
5. Build the CLI (`npm run build`), then in a scratch temp directory (e.g. under the scratchpad, not inside this repo) run the built `init` command against an empty project, and separately run `init --upgrade` against a directory pre-seeded with a minimal prior `.ai/kenkeep/` structure. After each, inspect `.ai/kenkeep/.config/prompts/` and confirm it contains only `proposal-extract.md`, `knowledge-admission.md`, and `sub-agent-delegation.md`.
6. Do not modify any source, test, or doc file as part of this task. If any check fails, document exactly which one and why, and report it as a blocker rather than silently patching the check or the underlying code.

</details>
