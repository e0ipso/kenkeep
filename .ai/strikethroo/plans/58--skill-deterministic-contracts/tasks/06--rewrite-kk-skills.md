---
id: 6
group: "skills"
dependencies: [1, 2, 3, 4, 5]
status: "pending"
created: 2026-06-27
skills:
  - markdown
complexity_score: 7
complexity_notes: "Large but single-skill (skill markdown) edit across five SKILL.md files plus shared appendices; must preserve every behavioral contract while removing prose."
---
# Rewrite the kk skills: validate loops, primitive calls, and single-sourced plumbing

## Objective
Edit the canonical skill sources under `src/templates-source/skills/kk-*` to
remove the three classes of redundant prose the plan targets, replacing them
with references to the primitives and scripts built in Tasks 1–5, while keeping
every genuine LLM-judgment rule as prose. This is the behavior-preserving core
of the plan: no CLI primitive, flag, action type, output schema, field name, or
conflict outcome may be removed or renamed.

## Skills Required
Markdown editing under kenkeep's skill conventions (skill `<!-- Version: N -->`
comments, cross-references between sibling skill files).

## Acceptance Criteria
- [ ] **Format-prose removal + validate loop:** the action-object schema prose, JSON skeleton, and per-field "field semantics by action" table are deleted from `kk-curate`; the equivalent node-shape narration is deleted from `kk-add` and `kk-bootstrap`. Each is replaced by a pointer to `kk schema <name>` and an explicit, mandatory produce → `kk validate <name>` → fix-and-repeat instruction. The operative judgment rules (add/modify/contradict/drop taxonomy, end-state rewrite, tightest-scope, `home_folder` placement) remain as prose.
- [ ] **curate Step 5 → `curate-persist`:** `kk-curate` Step 5's hand-rolled `node write` placement/failure loop is replaced by a single `curate-persist` call, matching `kk-session-extract`. No `node write` persistence loop remains in Step 5.
- [ ] **Step 7 → `kk conflict prepare`:** `kk-curate` Step 7's hand-computed diff-ratio default and sort/group are replaced by a `kk conflict prepare` call whose JSON the skill renders; the skill only presents and asks. The `y`/`n`/`s`/`k` tokens, the default highlighting, and outcomes are unchanged.
- [ ] **Parallel collector → `kk drafts collect`:** the inline `node -e` concat-and-validate block and the per-batch validation prose are replaced by a `kk drafts collect --run-id <id> --schema curator-output` call producing `$PROPOSALS`. The downstream `curate-dedup` step is unchanged.
- [ ] **kk-detect-root one-liner:** all five skills (`add`, `bootstrap`, `curate`, `migrate`, `session-extract`) drop the inlined `kk-detect-root` heredoc and use the single invocation form Task 4 selected (e.g. `npx kenkeep resolve-root` or `node .ai/kenkeep/scripts/kk-detect-root.mjs` per Task 4's recorded decision).
- [ ] **Delegation appendix:** the sub-agent probe → parallel-path (concurrency cap 5) → inline-fallback narrative is extracted into one shared appendix file referenced by `kk-curate`, `kk-bootstrap`, and `kk-add`; each skill keeps only a one-line pointer. No "reference runtime" wording remains anywhere in the edited scope (`rg 'reference runtime' src/templates-source` returns nothing).
- [ ] **Batch prompt single home:** `kk-curate` references the sibling `batch-agent-prompt.md` instead of inlining its text.
- [ ] **Admission criteria single-sourced:** the knowledge admission criteria (skip maintenance/lifecycle, plan/ticket/issue references, the "still true in six months" keep test) live in one shared source referenced by the curate drop rules, `kk-bootstrap` step 5, the batch prompt, and `proposal-extract.md`; the duplicated restatements are removed.
- [ ] **Harness block:** if Task 5 implemented self-detection, the skills' harness-resolution shrinks to root detection only (drop the `$HARNESS` resolution used solely for `index rebuild`); if Task 5 deferred, leave `$HARNESS` resolution in place.
- [ ] **Version bumps:** every skill whose behavior-affecting text changed has its `<!-- Version: N -->` comment incremented.
- [ ] Each rewritten `kk-*/SKILL.md` is materially shorter than its pre-edit `wc -l`, and a read-through confirms every CLI primitive, flag, action type, `home_folder`, field name, output schema, and conflict token/outcome that existed before still appears or is reachable via the referenced primitive.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Edit ONLY canonical sources under `src/templates-source/skills/kk-*` and any new shared files there (the delegation appendix, the admission-criteria source). Never hand-edit generated `templates/` or installed mirrors — Task 7 regenerates/mirrors them.
- The shared delegation appendix and admission-criteria source should be sibling files referenceable by each skill (follow the existing `batch-agent-prompt.md` / `proposal-extract.md` sibling-reference pattern).
- Preserve the exact reply tokens, default-highlighting behavior, and conflict outcomes in Step 7.

## Input Dependencies
- Task 1 (`kk schema` / `kk validate`, schema names), Task 2 (`kk conflict prepare`), Task 3 (`kk drafts collect`), Task 4 (`kk-detect-root` invocation decision), Task 5 (harness self-detect outcome).

## Output Artifacts
Rewritten `kk-*/SKILL.md` files, a shared delegation appendix, and a
single-sourced admission-criteria file under `src/templates-source/skills/`.
Consumed by Task 7 (build + mirror + docs) and Task 8 (validation).

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Record pre-edit line counts: `wc -l src/templates-source/skills/kk-*/SKILL.md` (baseline for the reduction claim and for Task 8).
3. Build a baseline checklist BEFORE editing: list every CLI primitive, flag, action type, `home_folder`, field name, output schema, and conflict token/outcome currently named in each skill. After editing, re-walk the checklist to confirm nothing was silently dropped (success criterion: behavior preserved). `kk-migrate` is the reference shape — it already delegates writes to primitives and carries no schema narration; converge the others toward it.
4. Apply edits skill-by-skill so you never leave a half-rewritten file:
   - `kk-curate` (largest, 529 lines): replace the action-schema prose/JSON skeleton/field table with `kk schema curator-output` + `kk validate` loop; Step 5 → `curate-persist`; Step 7 → `kk conflict prepare` (render + ask only); parallel collector → `kk drafts collect`; reference `batch-agent-prompt.md`; reference the admission-criteria source from the drop rules; one-line detect-root; collapse harness block per Task 5.
   - `kk-add`, `kk-bootstrap`: node-shape narration → `kk schema node` + validate loop; one-line detect-root; delegation-appendix pointer; (`kk-bootstrap` step 5) reference the admission-criteria source.
   - `kk-session-extract`, `kk-migrate`: one-line detect-root (and delegation pointer where they have one).
5. Create the shared delegation appendix from the near-verbatim probe/cap/fallback narrative now duplicated across curate/bootstrap/add. Remove the copy-pasted cap rationale and ALL "reference runtime" phrasing. Each skill keeps a single pointer line.
6. Create the admission-criteria source by lifting the criteria currently restated in curate drop rules, bootstrap step 5, `batch-agent-prompt.md`, and `proposal-extract.md`; replace each restatement with a pointer. The judgment stays prose — just in one place.
7. Bump `<!-- Version: N -->` in each behavior-changed skill. Do NOT introduce any persisted-schema `schema_version` bump — the Zod shapes are unchanged (plan clarification).
8. This task does NOT run the template build or touch mirrors — that is Task 7. Do not edit `templates/` or installed copies.
9. After edits, run `rg 'reference runtime' src/templates-source` (expect no hits in scope) and `rg 'kk schema|kk validate|conflict prepare|drafts collect|curate-persist|kk-detect-root|resolve-root' src/templates-source/skills` to confirm every expected reference resolves. Report the new `wc -l` per skill and the files you changed.
</details>
