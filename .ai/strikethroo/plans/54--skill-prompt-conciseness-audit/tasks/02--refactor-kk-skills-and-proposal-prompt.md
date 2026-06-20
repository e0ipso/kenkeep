---
id: 2
group: "kk-prompt-refactor"
dependencies: [1]
status: "pending"
created: 2026-06-20
skills:
  - skill-docs
  - prompt-engineering
complexity_score: 7
complexity_notes: "This task edits multiple mirrored skill files plus a model-facing prompt while preserving schema and workflow contracts."
---
# Refactor kk Skills and Proposal Prompt

## Objective
Extract duplicated kk helper/prompt material and tighten kk skill plus proposal-extract prose while preserving every behavior contract identified in task 1.

## Skills Required
Use `skill-docs` for skill procedure edits and mirrored file consistency, and `prompt-engineering` for the proposal extraction prompt trim and versioning decision.

## Acceptance Criteria
- [ ] The shared kk harness detector exists at the task-1-approved install-safe location, and all four kk skills reference it instead of embedding duplicate detection heredocs.
- [ ] If the detector lives under `.ai/kenkeep/scripts`, the canonical template skeleton and `init --upgrade` behavior install it for new and existing repos.
- [ ] `scripts/lint-detect-harness.mjs` is updated to validate the extracted detector source rather than the removed heredoc.
- [ ] `kk-curate` references a sibling `batch-agent-prompt.md`, and that sibling prompt exists in canonical source and every installed kk skill tree present in this checkout.
- [ ] `kk-curate`, `kk-bootstrap`, `kk-add`, and `kk-migrate` are materially more concise without changing primitives, flags, action types, schemas, conflict outcomes, `home_folder` placement, or curation/rebalance behavior.
- [ ] Canonical `src/templates-source/skills/kk-*`, generated `templates/skills/kk-*`, and installed kk skill copies remain synchronized where the repo expects identical shared content.
- [ ] `src/templates-source/prompts/proposal-extract.md` and `.ai/kenkeep/.config/prompts/proposal-extract.md` have duplicated guidance trimmed, example commentary reduced, and their `Version:` comments bumped if policy requires it.
- [ ] Any behavior-affecting skill prompt changes bump the relevant `<!-- Version: N -->` comments or document why the edit is reference-only and does not need a bump.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
Edit markdown and helper script assets only in the appropriate source-of-truth locations from task 1, then refresh generated and installed copies through the repo's normal mechanisms. Keep wording harness-neutral; remove references such as `-p` mode and "reference runtime" from edited scope. Preserve exact field names, output schema names, conflict resolution tokens, CLI primitive names, and flags. Treat `src/lib/schemas.ts` as the source of truth for curator fields.

## Input Dependencies
Requires task 1's baseline checklist and helper packaging decision.

## Output Artifacts
- Shared kk harness detector script.
- Updated kk skill files in the required skill trees/source templates.
- Extracted `batch-agent-prompt.md` sibling file where required.
- Updated `proposal-extract.md`.
- Updated detector drift lint and install/upgrade code if the helper location requires it.
- Changelog or release-note entry when prompt or skill version comments are bumped.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Implement the shared harness detector using the task 1 location decision. Replace each duplicated kk heredoc with a compact invocation that preserves the same detection behavior and fallback semantics.
2. If the heredoc is removed, update `scripts/lint-detect-harness.mjs` so it reads the new helper source and still compares registered harness ids and env detectors against the TypeScript adapter sources.
3. If the helper is placed under `.ai/kenkeep/scripts`, add the package skeleton source under `src/templates-source/kenkeep/scripts/`, add or preserve the current repo copy under `.ai/kenkeep/scripts/`, and update upgrade code to copy the helper when missing without overwriting user-owned files.
4. Extract the kk-curate batch sub-agent prompt into `batch-agent-prompt.md` next to the canonical skill source. Update the skill to require reading that file before batch dispatch, and propagate the sibling file to every installed kk skill tree present in this checkout.
5. Condense kk-curate by keeping operative action definitions and only the non-obvious edge cases:
   - `modify` end-state rewrite.
   - `modify` target existence verification so `node write` does not accidentally mint a fresh id.
   - `drop` salvage rule.
   - `contradict` tightest-scope rule.
   - `home_folder` root fallback and `--folder` behavior for `add`.
   - Conflict resolution token/outcome behavior.
   - Rebalance summary-fragment and required-field behavior.
6. Preserve the current schema contract from `src/lib/schemas.ts`: action fields include optional `home_folder`; `proposed_node` includes optional `depends_on`; do not reintroduce stale `suggested_resolution`.
7. Condense kk-bootstrap's delegation and concurrency wording with harness-neutral language.
8. Replace kk-add's implementation-flavored "byte-equivalent" wording with the requested inline-drafting wording.
9. Limit kk-migrate changes to the shared detector extraction unless task 1 reveals directly related duplicated prose.
10. Trim `proposal-extract.md` by merging overlapping durable-knowledge, transition, and exclusion guidance. Reduce example commentary where the JSON already demonstrates the rule.
11. Check prompt and skill versioning policy. If a top-of-file `Version:` marker or `<!-- Version: N -->` marker describes behavior and the wording change can alter model output, bump it and note the change for documentation/release follow-through in task 4.
12. Mirror kk skill edits into every installed harness directory present in this checkout after changing canonical source. Avoid editing generated `templates/` output by hand; run the build to refresh it.

</details>
