---
id: 1
group: "prompt-time-knowledge-injection"
dependencies: []
status: "pending"
created: 2026-06-20
skills:
  - typescript
  - vitest
complexity_score: 6
complexity_notes: "Adds new deterministic ranking logic and bounded rendering over existing node data."
---
# Build Prompt Retrieval Core

## Objective
Create the shared prompt-time retrieval and payload rendering module that ranks current on-disk knowledge leaf nodes against a user prompt and produces a bounded summaries-plus-links context block.

## Skills Required
TypeScript for the retrieval and rendering implementation, and Vitest for focused coverage of deterministic ranking, bounds, and payload shape.

## Acceptance Criteria
- [ ] A shared module under `src/lib/` ranks leaf nodes from existing node-loading APIs against prompt text without LLM calls, external services, embeddings, databases, persistent stores, or long-lived caches.
- [ ] Retrieval reads the current `.ai/kenkeep/nodes/` leaf tree through `readAllNodes`; it skips generated `index.md` files by using the existing API and does not attempt git committed-state filtering.
- [ ] Scoring weights title, tags, and summary above body text, includes a small deterministic graph edge boost or neighbor expansion, resolves only live ids (and redirects if the ledger is used), and applies stable tie-breaks.
- [ ] Output is bounded by explicit node-count and rendered-character limits with internal defaults; no new `config.yaml` setting is introduced for the MVP.
- [ ] The rendered context block includes node title, id, repo-relative path or markdown link, summary, useful tags, and an instruction to open relevant nodes before relying on details.
- [ ] Rendered context never includes full leaf bodies and does not log or persist the user prompt.
- [ ] Focused Vitest coverage proves deterministic ordering, prompt-specific inclusion/omission, graph influence, and budget truncation.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Use `readAllNodes` and existing node/frontmatter types from `src/lib/nodes.ts` rather than parsing markdown ad hoc. Preserve the tree-storage model: current markdown under `.ai/kenkeep/nodes/` is used; the feature should not add a git plumbing step to distinguish committed from uncommitted nodes. Keep the module pure and one-shot friendly; do not introduce background workers, caches that outlive the process, or new runtime dependencies unless already established in the repo. If graph scoring follows edges that point at retired ids, use `src/lib/redirects.ts` rather than inventing redirect parsing.

## Input Dependencies
No task dependencies. The implementation depends on the existing node schema, graph edge fields (`relates_to`, `depends_on`), optional redirects ledger helpers, and deterministic ordering patterns in `src/lib/index-gen.ts`.

## Output Artifacts
- `src/lib/prompt-retrieval.ts` or equivalent shared module.
- Focused retrieval tests, preferably fixture-based, such as `tests/lib/prompt-retrieval.test.ts`.
- Exported types/functions for prompt-time hooks to call.

## Implementation Notes
<details>
<summary>Implementation guidance</summary>

Start by inspecting `src/lib/nodes.ts`, `src/lib/redirects.ts`, `src/lib/index-gen.ts`, and current tests around determinism and node loading. Define a small API such as `retrievePromptKnowledge(nodesDir, prompt, options)` plus a renderer such as `renderPromptKnowledgeContext(matches, options)`.

Tokenize text locally with a conservative normalizer: lowercase, split on non-alphanumeric boundaries, drop empty terms, and avoid stemming unless the repo already has a helper for it. Score each node by matching prompt terms against the node title, tags, summary, and body. Keep weights simple and documented in code through named constants. Use graph data only as a small deterministic influence so lexical relevance remains primary.

Return paths relative to the repository or `.ai/kenkeep` consistently; a stable format such as `.ai/kenkeep/nodes/<node.relPath>` is preferred. The payload should be compact and actionable, not a full leaf dump. Include an explicit note that the agent should open linked nodes before relying on details, because summaries are only routing hints.

Handle empty prompts, missing `nodes/`, and zero matches as normal empty-result cases. Hook integration in task 2 should catch schema/read errors and fail open, but this module should still expose enough structure for tests to assert expected behavior without parsing stdout.

Write tests against temporary node trees or existing fixture helpers. Keep the suite small and meaningful: verify custom ranking logic, critical edge cases, and budget behavior rather than testing framework mechanics.
</details>
