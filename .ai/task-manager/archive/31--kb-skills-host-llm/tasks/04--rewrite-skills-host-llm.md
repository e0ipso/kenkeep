---
id: 4
group: "skills"
dependencies: [1, 2, 3]
status: "completed"
created: 2026-05-23
skills:
  - prompt-engineering
  - typescript
complexity_score: 5
complexity_notes: "Touches three skill prompts and four per-harness regenerations; faithful porting of runner-internal prompts into the skill body is the main risk. Kept as one task because the three skills share one regeneration step and one canonical-prompt format."
---
# Rewrite `kb-bootstrap`, `kb-curate`, `kb-add` skills to run the LLM in-host

## Objective
Replace the three skill prompts so that the host harness session itself drives the LLM work using `Read` / `Write` / `Bash` / `Glob` and the new deterministic primitives (`finddocs`, `node write`, `curate dedup`), instead of delegating to a CLI runner that spawns its own sub-agent. Regenerate per-harness skill copies from the canonical template source.

## Skills Required
- `prompt-engineering` — port the runner-embedded prompts into a single canonical `SKILL.md` per skill without losing instructions.
- `typescript` — run / extend the existing template-sync mechanism that regenerates per-harness skill copies.

## Acceptance Criteria
- [ ] `src/templates-source/skills/kb-bootstrap/SKILL.md` rewritten: drives discovery via `ai-kb finddocs`, reads candidate docs via `Read`, drafts node bodies inline, persists each via `ai-kb node write --source-doc … --source-hash …`, ends with `ai-kb index rebuild`. No `<harness> -p` recursion. No reference to a runner.
- [ ] `src/templates-source/skills/kb-curate/SKILL.md` rewritten: enumerates pending session logs in `captured_at` order, reads them via `Read`, drafts curator proposals across in-memory batches, pipes merged proposals to `ai-kb curate dedup`, calls `ai-kb node write` per surviving proposal, ends with `ai-kb index rebuild`.
- [ ] `src/templates-source/skills/kb-add/SKILL.md` rewritten: drafts a single node body inline and persists via `ai-kb node write` (preferred for the slug-collision guard) or `Write` directly. No interactive prompts.
- [ ] Before deleting any runner code (Task 6), the previously runner-embedded prompts have been diffed against each `SKILL.md` and any missing-but-load-bearing instructions are ported in. Capture this diff in the PR description.
- [ ] `Version:` comment at the top of each `SKILL.md` is bumped per `practice-bump-prompt-version-comment`.
- [ ] Per-harness copies (`.claude/skills/kb-*`, `.opencode/skills/kb-*`, plus codex/cursor equivalents) are regenerated from the templates via the existing template-sync mechanism. `git diff` after regeneration shows the per-harness copies match the templates.
- [ ] Skill prompts carry the documented feature-toggle / fallback per the plan's integration strategy: if the new primitives are not present, fall back to the legacy runner invocation for one release.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Canonical sources live under `src/templates-source/skills/kb-<name>/SKILL.md`. Touch only these files for prompt content; never hand-edit the per-harness copies.
- Use whatever script the repo already provides to regenerate per-harness skill copies (look in `package.json` scripts and `src/lib/install-skills.ts`).
- The skill must invoke primitives by their stable CLI shapes from Tasks 1–3.

## Input Dependencies
- Task 1 — `ai-kb finddocs` exists.
- Task 2 — `ai-kb node write` exists and accepts `--source-doc` / `--source-hash`.
- Task 3 — `ai-kb curate dedup` exists.

## Output Artifacts
- Three rewritten canonical `SKILL.md` files plus their per-harness regenerated copies.
- A documented set of LLM instructions that Task 6 can use to confirm nothing load-bearing was lost when deleting the runners.

## Implementation Notes
<details>
<summary>Details</summary>

- The runner-embedded prompts live in `src/lib/bootstrap.ts` (around `runHeadless`, line ~492) and `src/lib/curate.ts` (around `runHeadless`, line ~297). Read both in full **before** editing the skill templates. For each instruction in the runner prompt, decide: (a) already covered in `SKILL.md`, (b) needs to be ported, or (c) obsolete because the new architecture removes the concern. Record the decision per-line in the PR description so reviewers can verify no instruction was silently dropped.
- The `kb-bootstrap` skill should explicitly walk through: (1) `Bash` `ai-kb finddocs --from <scope> --with-hashes`, (2) for each line, `Read` the file, (3) decide if it warrants a node, (4) draft body inline, (5) `Bash` `ai-kb node write <kind> <slug> --from <tmpfile> --source-doc <relpath> --source-hash <sha>`, (6) at end, `Bash` `ai-kb index rebuild`.
- The `kb-curate` skill should batch its proposal-drafting to keep context tractable (mirror the batch sizing that lived in `CuratorRunner`), accumulate proposals in memory or in a tmpfile, then make exactly one `ai-kb curate dedup --input <tmpfile> --run-id <id>` call, then per surviving proposal call `ai-kb node write`, then `ai-kb index rebuild`.
- Feature-toggle / fallback: have each `SKILL.md` open by `Bash`-checking whether the new primitives are present (`ai-kb finddocs --help` exit code, etc.). If not, fall back to the pre-change "shell out to runner" instructions for one release. Plan section "Integration Strategy" bullet 2.
- After editing templates, run the template-sync script and commit the per-harness diffs in the same change so reviewers can see them.
- Do **not** delete the runners in this task — that is Task 6's job. The skill must still work today against the old CLI via the fallback, until the runner is gone.

</details>
