---
id: 5
group: "bootstrap-batching"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - prompt-engineering
---
# Switch bootstrap-incremental to single-file batches; drop `derived_from` from candidates

## Objective
Eliminate `chunkDocs` and the LLM-authored `derived_from` field by making every bootstrap-incremental batch exactly one file. The wrapper then attributes deterministically and unconditionally. Drop the cross-file attribution rule from the prompt and bump its version.

## Skills Required
- `typescript`: edit `src/lib/bootstrap.ts` (replace `chunkDocs` call; delete dead helpers); edit `BootstrapCandidateSchema` in `src/lib/schemas.ts`.
- `prompt-engineering`: trim `src/templates-source/prompts/bootstrap-incremental.md` and bump its version.

## Acceptance Criteria
- [ ] In `runBootstrapIncremental` (`src/lib/bootstrap.ts`, ~line 350+), the batching line becomes `const batches = candidates.map((c) => [c]);` (or equivalent one-per-file mapping).
- [ ] `chunkDocs` is deleted from `src/lib/bootstrap.ts`. `DEFAULT_TOKEN_BUDGET` is deleted if no remaining consumer exists. `tokenBudget` plumbing in `BootstrapContext` is removed if it served only `chunkDocs`. Verified via `git grep` before deletion.
- [ ] `bootstrap.ts:503-510` deterministic attribution becomes unconditional: `derivedFrom = [batch[0].relPath]`.
- [ ] `BootstrapCandidateSchema` (`src/lib/schemas.ts:174-185`) drops the `derived_from` field. `supports_existing_node` and `contradicts_existing_node` become `z.null().default(null)` for consistency with the proposal-extract treatment.
- [ ] `bootstrap-incremental.md` loses the "If two files cover the same topic, produce one candidate per topic, with both files in `derived_from`" rule (current line 94).
- [ ] `bootstrap-incremental.md` output schema drops the `derived_from` field from each candidate. Any prose teaching the LLM about cross-file attribution is removed.
- [ ] `bootstrap-incremental.md` `<!-- Version: 2 -->` becomes `<!-- Version: 3 -->`.
- [ ] A new integration test asserts: given N markdown files in a temp dir, `runBootstrapIncremental` produces N batches (one per file), and each resulting node's `derived_from` is `[<that-file-relPath>]`.
- [ ] Existing bootstrap fixtures are updated to drop `derived_from` from candidate JSON.
- [ ] `pnpm exec tsc --noEmit` and `pnpm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Single-file batches: `candidates.map(c => [c])` is the entire batching logic.
- Settings: if plan 11 already removed `tokenBudget` from settings, the surface here is smaller. Verify with `git grep tokenBudget src tests` before deletion.

## Input Dependencies
- None. Independent of tasks 1-4.

## Output Artifacts
- `chunkDocs` deleted, batching simplified, `derived_from` field gone from the bootstrap candidate schema and prompt, version bumped.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. `git grep -n 'chunkDocs\|DEFAULT_TOKEN_BUDGET\|tokenBudget' src tests`. Note every consumer. Delete in dependency order (innermost helpers last).
2. In `src/lib/bootstrap.ts`, replace `const batches = chunkDocs(candidates, tokenBudget);` with `const batches = candidates.map((c) => [c]);`. The `tokenBudget` argument is now unused; remove it from the signature chain.
3. Simplify the attribution block at `bootstrap.ts:503-510`. The conditional ("if batch.length === 1") goes away; `derivedFrom = [batch[0].relPath]` is unconditional.
4. Delete `chunkDocs` and its tests. Delete `DEFAULT_TOKEN_BUDGET` if grep shows no remaining consumers. Remove `tokenBudget` from `BootstrapContext` and any constructor wiring.
5. Edit `src/lib/schemas.ts:174-185` `BootstrapCandidateSchema`: drop `derived_from`. Change the two hint fields to `z.null().default(null)`.
6. Open `src/templates-source/prompts/bootstrap-incremental.md`. Delete the cross-file attribution rule (line 94). Delete the `derived_from` line from the output schema section. Delete any cascading prose ("ensure each candidate is attributed", etc.). Bump `<!-- Version: 2 -->` to `3`.
7. Update bootstrap fixtures: `git grep -l 'derived_from' tests/fixtures/bootstrap` and remove the field from candidate JSON.
8. Tests:
   - Integration: write 3 markdown files to a temp directory, run `runBootstrapIncremental` with a stubbed LLM that returns one valid candidate per batch, assert 3 batches were created and each resulting node frontmatter has `derived_from: [<expected-relPath>]`.
   - Optionally: assert the bootstrap log under `_logs/bootstrap-incremental/` records 3 separate spawns (if logging is part of the function's observable behavior; otherwise skip).
9. Run typecheck and tests. Inspect `pnpm test` output for any deleted-test gaps; if `chunkDocs.test.ts` existed it goes away with the function.

</details>

### Meaningful Test Strategy Guidelines

Critical mantra: "write a few tests, mostly integration."

**Write tests for:**
- Integration: N input files produce N batches and N nodes with correct deterministic `derived_from`.

**Do NOT write tests for:**
- Trivial `candidates.map` behavior.
- Re-testing Zod `.strict()` or `.default()` mechanics already covered in tasks 3 and 4.
- Deleted helpers (their tests get deleted with them).
