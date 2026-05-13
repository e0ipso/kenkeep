---
id: 4
group: "minor-polish"
dependencies: [3]
status: "pending"
created: 2026-05-13
skills:
  - typescript
  - prompt-engineering
---
# Drop `index_summary` from curator batch payload; bump curator prompt to Version 5

## Objective
Stop reading `INDEX.md` and shipping it as `index_summary` on every curator batch. Update both copies of the curator prompt (`src/templates-source/prompts/curator.md` and `templates/prompts/curator.md`) to drop the third input, bump the `Version:` comment from 4 to 5, and instruct the curator to emit a `drop` action with a rationale when a candidate seems to overlap an existing node not listed in `existing_nodes`.

## Skills Required
- `typescript`: edit `src/lib/curate.ts` (`buildBatchPayload`, `CuratorBatchPayload`).
- `prompt-engineering`: edit both copies of `curator.md` consistently, keeping the prompt's structure and style intact.

## Acceptance Criteria
- [ ] `rg -n 'index_summary' src/ tests/ templates/ src/templates-source/` returns zero hits.
- [ ] `CuratorBatchPayload` no longer declares an `index_summary` field.
- [ ] `buildBatchPayload` no longer reads `INDEX.md` (no `join(kbDir, 'INDEX.md')`; no `indexSummary` local; no `index_summary:` in the returned object).
- [ ] If the `kbDir` parameter on `buildBatchPayload` becomes unused after the deletion, drop the parameter and update the single caller; if any other field still needs it, keep it.
- [ ] Both `src/templates-source/prompts/curator.md` and `templates/prompts/curator.md` display the comment `Version: 5` at the top.
- [ ] Both prompts list **two** inputs (proposal candidates and existing-node bodies). The "current KB index" / "third input" enumeration is gone.
- [ ] Both prompts contain a clear instruction (under **Action: drop** or **Constraints**) along the lines of: "If a candidate seems to overlap an existing node not listed in `existing_nodes`, emit a `drop` with a rationale explaining the overlap. The candidate's `supports_existing_node` / `contradicts_existing_node` pointers are the only existing-node context you have; act conservatively when in doubt."
- [ ] Any earlier directive in the prompt that tells the curator to "also scan the index" (e.g., the "Final instructions" step that mentions the index) is rewritten to reference the proposal's `supports_existing_node` / `contradicts_existing_node` pointers and the `existing_nodes` bodies provided in the batch.
- [ ] `diff src/templates-source/prompts/curator.md templates/prompts/curator.md` returns zero differences.
- [ ] `npm run lint && npm run typecheck && npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `buildBatchPayload` lives in `src/lib/curate.ts:207-249`. Delete:
  - `index_summary: string;` from `CuratorBatchPayload` (declared somewhere between lines 188-249).
  - `const indexFile = join(kbDir, 'INDEX.md');` and the `const indexSummary = ...` read (and any `await readFile` / `await readFileOptional` it uses).
  - `index_summary: indexSummary,` from the returned object literal.
- Confirm whether `kbDir` is referenced by any other field in the payload after the deletion. If not, drop the parameter from `buildBatchPayload`'s signature and update its single caller. If it is, leave the parameter alone (prefer accuracy over hypothetical cleanup).
- Both prompts must remain byte-identical after the edit. If the build step `scripts/build-templates.mjs` regenerates `templates/prompts/curator.md` from `src/templates-source/prompts/curator.md`, running `npm run build:templates` after editing the source-of-truth file is sufficient. Confirm by running the build and diffing the two files.
- The `Version:` comment lives at the top of the prompt as a `<!-- Version: 4 -->` (or similar) HTML comment. Bump to `Version: 5`.
- The plan's prompt-change list is binding; the "rely on hints + bodies, conservative when in doubt" instruction is the substantive behavior change.

## Input Dependencies
- Task 3 must be merged first (it edits `src/commands/curate.ts`; this task edits `src/lib/curate.ts`. Sequential merging keeps the test harness consistent at every commit.).

## Output Artifacts
- Edited `src/lib/curate.ts`: `CuratorBatchPayload` shrinks; `buildBatchPayload` no longer reads `INDEX.md`.
- Edited `src/templates-source/prompts/curator.md` and `templates/prompts/curator.md`: Version bumped to 5; two inputs listed; new overlap-but-not-listed → drop instruction.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `src/lib/curate.ts` lines 188-249 to understand the current `CuratorBatchPayload` shape and the `buildBatchPayload` body.
2. Inspect every field in `buildBatchPayload`'s returned object to confirm `kbDir` is only used to construct the `INDEX.md` path. If `kbDir` is needed elsewhere, leave the parameter; otherwise plan to remove it from the signature and update the call site (likely in `runCurate`).
3. Delete:
   - `index_summary: string;` (or `index_summary: z.string()` if it lives on a Zod schema) from `CuratorBatchPayload`.
   - The `INDEX.md` read inside `buildBatchPayload`.
   - The `index_summary:` line from the returned object.
4. If the `kbDir` parameter is now unused, drop it from `buildBatchPayload`'s signature and update the caller. Re-run `tsc --noEmit` to confirm.
5. Read both `src/templates-source/prompts/curator.md` and `templates/prompts/curator.md` in full. They should be byte-identical now.
6. Edit `src/templates-source/prompts/curator.md`:
   - Bump the `Version: 4` comment line to `Version: 5`.
   - Find the "three inputs" enumeration (around line 16-22 per the plan): remove the third bullet ("The current KB index" / `index_summary`) and renumber/restructure so the remaining list reads as two inputs.
   - In **Action: drop** (or **Constraints**, whichever section reads more naturally), add a bullet such as:
     > If a candidate seems to overlap an existing node that was not passed in via `existing_nodes`, emit a `drop` action with a rationale explaining the overlap. The candidate's `supports_existing_node` / `contradicts_existing_node` pointers and the `existing_nodes` bodies are the only existing-node context available; act conservatively when in doubt.
   - Find the "Final instructions" step that previously mentioned scanning the index (the plan refers to "step 2: also scan the index"). Rewrite it to: "Rely on the proposal's `supports_existing_node` / `contradicts_existing_node` pointers and the `existing_nodes` bodies provided in the batch."
   - Sweep the rest of the prompt for any remaining `index_summary` / "current KB index" / "KB index" references and remove them.
7. Apply the **same** edits to `templates/prompts/curator.md`. If the project's build step regenerates `templates/` from `src/templates-source/`, run `npm run build:templates` and confirm the file is regenerated identically; otherwise, edit by hand.
8. `diff src/templates-source/prompts/curator.md templates/prompts/curator.md` — must be empty.
9. Run `npm run lint && npm run typecheck && npm test`. Fix any test that compared against an old payload shape or against an old prompt snapshot.
10. Final sweep: `rg -n 'index_summary|current KB index|KB index' src/ tests/ templates/ src/templates-source/` — expect zero hits outside CHANGELOG / archived plans.

</details>
