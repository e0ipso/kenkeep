---
id: 5
group: "index-catalog-rewrite"
dependencies: [1, 2, 3, 4]
status: "pending"
created: 2026-05-13
skills:
  - bash
  - typescript
---
# Run self-validation: grep zero-hits, lint/typecheck/test, manual rebuild, smoke tests

## Objective

Execute the plan's Self Validation block. Confirm zero orphaned references to the removed budget-trim symbols, green automated checks, and a manual `index rebuild` against the live `.ai/knowledge-base/nodes/` fixture that yields a well-formed catalog. Smoke-test the curate pipeline and a fresh SessionStart injection.

## Skills Required

- **bash**: grep / pipeline / build invocation.
- **typescript**: `npm run typecheck` and reading any compiler output to locate remaining issues.

## Acceptance Criteria

- [ ] `npm test`, `npm run typecheck`, and `npm run lint` all return clean (zero failures, zero errors).
- [ ] `grep -rn 'indexBudgetTokens\|budget_tokens\|hiddenByBudget\|MIN_PER_KIND\|DEFAULT_BUDGET_TOKENS\|--budget-tokens' src/ tests/ docs/ IMPLEMENTATION.md` returns zero matches.
- [ ] After `npm run build` (or the project's build alias), `node dist/cli.js index rebuild` succeeds against the repo's `.ai/knowledge-base/nodes/` and writes a new `.ai/knowledge-base/INDEX.md`.
- [ ] The regenerated `INDEX.md` contains all currently valid node titles in either `## Conventions (how we build)` or `## Components (what exists)`. The count matches the current 41 (or whatever is current at run time).
- [ ] The regenerated `INDEX.md` contains a `## By topic` block with each distinct tag, each line in the format `- **#<tag> (<count>):** <title>, <title>, ...`.
- [ ] The header footer reads `_N nodes • V valid • S superseded • ~T estimated tokens_` with `T` in the 900–1300 range for the current 41-node KB.
- [ ] At least one node known to have multiple incoming `relates_to` edges (inspect via `GRAPH.md`) renders above zero-degree siblings within its section.
- [ ] The body contains zero ` — ` (em-dash) sequences inside bullets, and every bullet for a tagged node contains at least one `#`-prefixed tag.
- [ ] A fresh Claude Code session starts cleanly with no SessionStart hook errors (manual smoke).
- [ ] A curate run against a queued/synthetic session log completes without error (manual smoke).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Local Node.js + TypeScript toolchain (`npm`, `tsc` via `npm run typecheck`).
- A populated `.ai/knowledge-base/nodes/` (the repo's own KB is the fixture).
- Optional: a queued session log under the configured queue dir, for the curate smoke. Generate one if none exists.

## Input Dependencies

- Tasks 1–4 must be complete: generator rewrite, settings/CLI cleanup, test updates, and docs updates.

## Output Artifacts

- A green `npm test` / `npm run typecheck` / `npm run lint` log.
- An updated `.ai/knowledge-base/INDEX.md` reflecting the catalog model.
- A note recording the estimated_tokens value, valid/superseded counts, and any tag-bucket sample inspection.

## Implementation Notes

<details>
<summary>Step-by-step verification guide</summary>

1. From repo root, run in sequence:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
   All three must be clean. If any fail, fix the offending file (in tasks 1–3's scope) and rerun.
2. Run the symbol-grep:
   ```bash
   grep -rn 'indexBudgetTokens\|budget_tokens\|hiddenByBudget\|MIN_PER_KIND\|DEFAULT_BUDGET_TOKENS\|--budget-tokens' \
     src/ tests/ docs/ IMPLEMENTATION.md
   ```
   Expect zero hits. A single hit means a follow-up edit is required in the corresponding earlier task's scope.
3. Build and run the catalog regen against the live KB:
   ```bash
   npm run build
   node dist/cli.js index rebuild
   ```
   Open `.ai/knowledge-base/INDEX.md` and check:
   - The header footer line matches `_<N> nodes • <V> valid • <S> superseded • ~<T> estimated tokens_`.
   - Section order: `## Conventions (how we build)` → `## Components (what exists)` → `## By topic` → optionally `## Recently superseded`.
   - Every valid node title appears once in `Conventions` or `Components`. Use `grep -c '^- \*\*' INDEX.md` against expected counts.
   - The `## By topic` block enumerates tags such as `#hooks`, `#kb-pipeline`, etc., each with a count and comma-separated title list.
   - No bullet contains ` — `. Every tagged node's bullet contains at least one `#tag`.
4. Pick a node with multiple incoming edges (inspect `.ai/knowledge-base/GRAPH.md` to find one with several inbound `relates_to` arrows). Confirm its bullet position in the regenerated INDEX precedes a known zero-degree sibling within the same section.
5. Smoke-test SessionStart: launch a new Claude Code session in this repo. Confirm no hook errors appear at startup and that the SessionStart context injection succeeds. If the hook is logged, confirm wall-clock under 1s.
6. Smoke-test curate: ensure there's at least one queued session log (capture one by running through a short session if necessary). Run `node dist/cli.js curate` (or the equivalent invocation) and confirm the subprocess parses INDEX as context without error.
7. Optional smoke-test bootstrap-incremental: run against a single fixture doc and confirm INDEX still parses as opaque context.
8. If any acceptance criterion fails, do **not** patch it in this task. Re-open the corresponding upstream task (1, 2, 3, or 4) and address it there. This task is the verification gate, not an implementation surface.

</details>

<details>
<summary>Out of scope for this task</summary>

- Implementing any code or doc change. This task only runs gates and reports.
- Manually editing `.ai/knowledge-base/INDEX.md` (it is generated; if it looks wrong, fix the generator).

</details>
