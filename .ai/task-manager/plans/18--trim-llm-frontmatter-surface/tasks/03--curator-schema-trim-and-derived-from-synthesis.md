---
id: 3
group: "curator-trim"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - typescript
  - prompt-engineering
---
# Trim curator output schema and synthesize `derived_from` in wrapper

## Objective
Stop asking the LLM for `id` and `derived_from`: the wrapper already overwrites `id` from `deriveNodeId`/`target_node_id` and can synthesize `derived_from` from `candidate_origin`. Tighten the wrapper-side schema so any reintroduction fails parse, and bump the curator prompt version per `practice-prompt-versioning`.

## Skills Required
- `typescript`: edit `CuratorProposedNodeSchema` in `src/lib/schemas.ts`, refactor `buildNodeFrontmatter` in `src/lib/curate.ts` to accept an explicit `derivedFrom` argument, thread `pending` lookups through the action loop.
- `prompt-engineering`: trim `src/templates-source/prompts/curator.md` output schema bullets and bump the `Version:` HTML comment.

## Acceptance Criteria
- [ ] `CuratorProposedNodeSchema` (in `src/lib/schemas.ts`) has the shape `{ title, kind, tags, summary, body, confidence, relates_to }.strict()`. The `id` and `derived_from` fields are removed.
- [ ] `buildNodeFrontmatter` in `src/lib/curate.ts:475-490` no longer reads `proposedNode.id` or `proposedNode.derived_from`. Its signature accepts an explicit `derivedFrom: string[]` argument supplied by the caller.
- [ ] The caller derives `derivedFrom` by parsing `candidate_origin` (`<session_id>:<practice|map>:<index>` format already parsed at `curate.ts:344-360`) and mapping `session_id` to `pending[i].filename`. For modify actions, `derivedFrom` may be an empty array or the merged set as `buildNodeFrontmatter` already handles.
- [ ] `curator.md` `proposed_node` description and any output-schema bullet list drop both the `id` and `derived_from` lines. Field-semantics table is verified to have no `id`/`derived_from` row.
- [ ] No remaining prose anywhere in `curator.md` instructs the LLM to emit `id` or `derived_from`.
- [ ] `curator.md` `<!-- Version: 4 -->` (or equivalent) becomes `<!-- Version: 5 -->`.
- [ ] Existing curator test fixtures under `tests/fixtures/curator/` (or wherever curator JSON fixtures live) are updated so they no longer include `id` or `derived_from` in `proposed_node` objects.
- [ ] A new test asserts the strict schema rejects (a) `id` present, (b) `derived_from` present, (c) an unknown key.
- [ ] A new (or updated) test asserts a curate run end-to-end produces a node whose written `derived_from` matches the originating session filename, sourced from `candidate_origin`, not from any LLM-emitted field.
- [ ] `pnpm exec tsc --noEmit` and `pnpm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Zod: `.omit({ id: true, derived_from: true })` followed by `.strict()`, or rewrite the schema literal-by-literal. Prefer rewriting for readability.
- The `candidate_origin` -> session filename lookup: extend the existing parser at `curate.ts:344-360` to return the resolved filename, or perform the lookup inline at the action dispatch site where `pending[i]` is in scope.
- Keep `buildNodeFrontmatter`'s output shape (the persisted frontmatter on disk) unchanged — only its input contract changes.

## Input Dependencies
- None. Independent of task 1/2.

## Output Artifacts
- Trimmed `CuratorProposedNodeSchema`, refactored `buildNodeFrontmatter`, updated curator prompt, version bump.
- Establishes the curator-side prompt edits that task 4 piggybacks on (task 4 will also touch `curator.md` for the hint line; coordinate sequencing).

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Open `src/lib/schemas.ts:128-138` and rewrite `CuratorProposedNodeSchema` to the seven-field shape with `.strict()`. Update the inferred TS type usages if any consumer destructured `id` or `derived_from`.
2. Compile (`pnpm exec tsc --noEmit`). Every reference to `proposedNode.id` or `proposedNode.derived_from` will surface as a type error. Fix each:
   - `id`: callers already pass through `target_node_id` (modify) or call `deriveNodeId` (add) — the LLM-emitted id was never used downstream. Delete the dead read.
   - `derived_from`: refactor `buildNodeFrontmatter` to take `derivedFrom: string[]`. Update its call sites to pass the lookup result.
3. Locate the action dispatch loop (`applyAction` / `dispatchAction` in `src/lib/curate.ts`). For each action, the `candidate_origin` parser gives `{ sessionId, kind, index }`. Resolve `sessionId` to `pending[i].filename` by matching the `pending` array. Pass the resulting `[filename]` (or merged array on modify) as `derivedFrom` to `buildNodeFrontmatter`.
4. Open `src/templates-source/prompts/curator.md`. Bullet-list deletion at lines 133-145: drop the `id:` and `derived_from:` lines from the `proposed_node` output schema description. Re-read the prompt top-to-bottom and remove any inline mention of those fields (search: `\bid\b`, `derived_from`). Verify the field-semantics table.
5. Bump `<!-- Version: 4 -->` (or whatever the current number is) to `5` at the prompt top.
6. Update fixtures under `tests/fixtures/curator/` (or wherever curator JSON fixtures live) so existing replay tests still parse. Use `git grep` for `"id":` and `"derived_from":` inside fixture files.
7. Add a strict-schema rejection test: parse a JSON payload that includes `id: "x"`, expect a Zod parse error.
8. Add an attribution-correctness test: feed a candidate with a known `candidate_origin` through the curator wrapper (with a mocked LLM that returns a `proposed_node` lacking `id` and `derived_from`) and assert the written node file has `derived_from: [<expected-filename>]`.

</details>

### Meaningful Test Strategy Guidelines

Critical mantra: "write a few tests, mostly integration."

**Write tests for:**
- Strict schema rejection of `id`, `derived_from`, and unknown keys (one parametric test).
- Integration: curate flow with a stubbed LLM response that yields a valid 7-field `proposed_node`; assert written file's `derived_from` matches the session filename.

**Do NOT write tests for:**
- Zod's `.strict()` behavior in isolation.
- Frontmatter serialization (covered by existing tests).
- The interactive curator prompt UX.
