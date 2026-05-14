---
id: 4
group: "proposal-extract-hints"
dependencies: [3]
status: "completed"
created: 2026-05-13
skills:
  - typescript
  - prompt-engineering
---
# Lock proposal-extract hint fields to literal null; remove hint-consumer wrapper code

## Objective
Convert `supports_existing_node` and `contradicts_existing_node` to literal-null in the wrapper schema and drop them from the proposal-extract prompt. Remove the `buildBatchPayload` lookup that consumed those hints. Drop the curator prompt line that referenced them. Bump both prompt versions.

## Skills Required
- `typescript`: edit `ProposalCandidateSchema` in `src/lib/schemas.ts`; trim `buildBatchPayload` in `src/lib/curate.ts:207-249`.
- `prompt-engineering`: trim `src/templates-source/prompts/proposal-extract.md` output schema and `src/templates-source/prompts/curator.md` hint instruction; bump versions.

## Acceptance Criteria
- [ ] `ProposalCandidateSchema` (`src/lib/schemas.ts:62-71`) sets `supports_existing_node: z.null().default(null)` and `contradicts_existing_node: z.null().default(null)`.
- [ ] A parse of a candidate with `"supports_existing_node": "some-id"` (or any non-null) fails loudly. Test covers this.
- [ ] `proposal-extract.md` output-schema section (around lines 260-275) no longer lists `supports_existing_node` or `contradicts_existing_node`. The candidate's required output fields are: `kind`, `tags`, `title`, `summary`, `body`, `confidence`.
- [ ] All prose in `proposal-extract.md` referencing the two fields or "the curator populates this later" is removed.
- [ ] `proposal-extract.md` `<!-- Version: 2 -->` becomes `<!-- Version: 3 -->`.
- [ ] `buildBatchPayload` in `src/lib/curate.ts:207-249` no longer constructs a `referenced` set from candidate hints. `existing_nodes` is always an empty array (key preserved in the payload to keep prompt-template shape stable).
- [ ] `curator.md` no longer contains the "Use the proposal's `supports_existing_node`/`contradicts_existing_node` hints" instruction (around line 151).
- [ ] `curator.md` `Version:` bumps once more from the value left by task 3 (5 -> 6).
- [ ] Existing proposal-extract fixtures under `tests/fixtures/` are updated to drop the two fields from candidate JSON (or set them to null where present).
- [ ] `pnpm exec tsc --noEmit` and `pnpm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Zod: `z.null().default(null)` produces a schema that accepts `null` or omitted (defaulting to `null`), rejects any non-null value.
- `buildBatchPayload`: keep the function signature stable; only its internals change. `existing_nodes: []` preserved.

## Input Dependencies
- Task 3 must land first because both tasks touch `src/templates-source/prompts/curator.md` and both bump its `Version:`. Sequencing avoids merge ambiguity.

## Output Artifacts
- Hint surface removed end-to-end: prompt no longer emits, wrapper no longer reads.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Edit `src/lib/schemas.ts:62-71`: change both hint fields to `z.null().default(null)`. Run typecheck; fix any downstream consumer that expected `string | null`. Most consumers should already treat them as null-or-string and the change narrows that to `null`; the hint-consumer in `buildBatchPayload` (next step) is the main caller.
2. Edit `src/lib/curate.ts:207-249` `buildBatchPayload`: delete the `referenced` set, the `for` loop that scans candidates for non-null hints, and the conditional `existing_nodes` assembly. Replace with `existing_nodes: []`. Keep the payload key so the prompt template still receives an array.
3. Open `src/templates-source/prompts/proposal-extract.md`. Delete the two output-schema bullets at lines 271-274 (or wherever they live post-cleanup). Search for any remaining mention of either field name and delete the surrounding prose. Bump `<!-- Version: 2 -->` to `3`.
4. Open `src/templates-source/prompts/curator.md`. Find and delete the "Use the proposal's `supports_existing_node`/`contradicts_existing_node` hints" instruction (around line 151). Rewrite the surrounding paragraph if necessary so the curator is told to use `INDEX.md` only for the existing-node scan. Bump `Version:` to `6` (one above what task 3 left).
5. Update fixtures: `git grep -l supports_existing_node tests/fixtures` and edit each. Same for `contradicts_existing_node`. Drop the fields or set them to null.
6. Tests:
   - Parametric Zod-rejection test for both hint fields with a non-null value.
   - Update any existing `buildBatchPayload` test to assert `existing_nodes` is always an empty array (and the `existing_nodes` key is still present).

</details>

### Meaningful Test Strategy Guidelines

Critical mantra: "write a few tests, mostly integration."

**Write tests for:**
- Schema rejection of non-null hint values.
- `buildBatchPayload` always emits `existing_nodes: []`.

**Do NOT write tests for:**
- Zod's `.default()` mechanics in isolation.
- Curator behavior with the trimmed prompt (covered by integration tests in task 3).
