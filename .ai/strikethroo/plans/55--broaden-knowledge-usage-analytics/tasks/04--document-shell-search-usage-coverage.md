---
id: 4
group: "documentation"
dependencies: [2]
status: "completed"
created: 2026-06-20
skills:
  - documentation
  - product-spec
  - repo-conventions
complexity_score: 3
complexity_notes: "Documentation-only task, but it must avoid generated templates and avoid overstating command/search attribution."
---
# Document Shell Search Usage Coverage

## Objective
Update project documentation so the stated usage instrumentation coverage matches the new shell/search command extraction behavior.

## Skills Required
Requires `documentation`, `product-spec`, and `repo-conventions` skills to update public and internal wording without editing generated files or overstating usage analytics as decision logic.

## Acceptance Criteria
- [ ] `AGENTS.md` read-signal documentation includes shell/search command coverage for supported harnesses.
- [ ] `PRD.md` section 9.12 clarifies that usage instrumentation observes dedicated read tools plus supported shell/search command path candidates.
- [ ] Either `docs/internals/hooks.md` or `docs/internals/architecture.md` is updated if the implementation changes the internal capture or usage wording there.
- [ ] Documentation preserves the existing boundary that `.ai/kenkeep/.state/usage.jsonl` is instrumentation only and not a pruning, rebalance, or curation decision input.
- [ ] Documentation does not claim a usage schema change or new access-method metadata.
- [ ] Documentation states that directory-only searches, globs, shell output parsing, and arbitrary assistant prose are not counted unless the implementation explicitly supports and tests them.
- [ ] No generated `templates/` files are edited, and no prompt `Version:` comments are changed.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Keep docs changes tied to the implemented behavior. Do not document unimplemented dashboards, reporting flows, pruning, rebalance decisions, analytics schema migrations, or per-method usage metadata.

## Input Dependencies
Depends on Task 2's implementation details so the wording can accurately name the supported harness command sources.

## Output Artifacts
- Updated `AGENTS.md`.
- Updated `PRD.md`.
- Updated `docs/internals/hooks.md` or `docs/internals/architecture.md` if implementation details require it.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Start from the read-extraction table in `AGENTS.md`, which currently describes only dedicated read-tool signals per harness. Update it to mention command-bearing shell/search events for each supported harness, but keep wording defensive where transcript shapes can vary.

For `PRD.md` or internals docs, clarify:

- Usage remains a write-only instrumentation ledger.
- Existing records remain valid.
- The record shape remains `{ document, type, session_id, used_at }`.
- The usage layer remains the safety filter for markdown documents under `.ai/kenkeep/nodes/`.
- Command/search coverage means explicit markdown file path candidates visible in supported tool input. It does not imply exhaustive attribution for `rg`/`grep` over a directory unless the implementation includes a tested policy for that.

Do not add any promise that usage counts drive curation, rebalance, pruning, ranking, or product decisions in this change.
</details>
