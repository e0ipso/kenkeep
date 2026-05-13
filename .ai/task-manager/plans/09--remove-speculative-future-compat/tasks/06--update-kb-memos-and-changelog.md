---
id: 6
group: "documentation"
dependencies: [1, 2, 3, 4, 5]
status: "completed"
created: 2026-05-13
skills: ["markdown"]
---
# Update KB Memos and CHANGELOG

## Objective
Bring the project's knowledge-base memos and CHANGELOG in line with the code state after the five removals. The two KB nodes that describe the adapter abstraction (`practice-v1-claude-code-only` and `map-adapter-interface`) are now outdated and must either be rewritten or deleted. A new CHANGELOG entry describes the removals and the on-disk artifact behavior.

## Skills Required
- `markdown`: rewrite or delete KB memo documents; author a clear CHANGELOG entry.

## Acceptance Criteria
- [ ] `.ai/knowledge-base/nodes/practice/practice-v1-claude-code-only.md` is either deleted or rewritten so it no longer describes an `Adapter` interface as the assistant-specific seam. If rewritten, it documents the current shape (Claude Code is the only assistant; assistant-specific code lives in dedicated helpers like `src/lib/hooks-config.ts` and direct `runHeadlessClaude` calls).
- [ ] `.ai/knowledge-base/nodes/map/map-adapter-interface.md` is deleted (the artifact it describes no longer exists). Any node referencing it via `relates_to` is updated to drop the dead link.
- [ ] `CHANGELOG.md` has a new bullet under `## Unreleased > ### BREAKING CHANGES` that summarizes: (a) removal of the `Adapter` interface and `ClaudeAdapter` class; (b) removal of the `depends_on` field from node frontmatter; (c) removal of the `topics` field from session-log frontmatter; (d) collapse of `RoleTaggedTranscript` to `interleaved` only; (e) deletion of the unused `packageName()` export. The entry explicitly notes that existing on-disk artifacts with stray `depends_on: []` or `topics: []` lines remain parseable (no user action required).
- [ ] After this task, `rg -n "Adapter\\b|map-adapter-interface" .ai/knowledge-base/nodes/` returns no hits (the deleted node id no longer appears in any `relates_to` list, and no memo body still describes the dropped interface).
- [ ] No retrospective framing in prose ("previously...", "earlier versions did X") outside the CHANGELOG itself.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The KB nodes must keep valid frontmatter per the schema after edits (delete the file outright if no current content remains).
- If `map-adapter-interface` appears in any other node's `relates_to` (it appears in `practice-v1-claude-code-only.md`), that reference must be removed in the same edit. After the dust settles, run lint to confirm no `dangling-edge` errors.

## Input Dependencies
- Depends on Tasks 1-5 (the removals) so the docs reflect the post-cleanup state.

## Output Artifacts
- Deleted or rewritten `.ai/knowledge-base/nodes/practice/practice-v1-claude-code-only.md`.
- Deleted `.ai/knowledge-base/nodes/map/map-adapter-interface.md`.
- Updated `.ai/knowledge-base/INDEX.md` and `.ai/knowledge-base/GRAPH.md` (regenerated via `node dist/cli.js index rebuild` or by running tests that exercise the generator).
- Updated `CHANGELOG.md` with a new `## Unreleased` BREAKING CHANGES bullet.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. **Decide rewrite vs delete for `practice-v1-claude-code-only.md`**:
   - The memo's central claim ("v1 supports Claude Code as the sole assistant") is still true and useful KB content.
   - Its framing of the `Adapter` interface as "the seam" is now wrong.
   - Preferred path: rewrite. Replace the body so it states (a) Claude Code is the only supported assistant, (b) assistant-specific code lives directly in `src/lib/hooks-config.ts` (hook setup) and via direct `runHeadlessClaude` calls (subprocess invocation), (c) no plurality is implied or prepared for.
   - Remove `map-adapter-interface` from the memo's `relates_to` array (since the target node is being deleted).
   - Do not include "previously had an Adapter interface" or similar retrospective framing per the project's `feedback_no_retrospective_framing` guidance. Describe only the current design.

2. **Delete `map-adapter-interface.md`** outright: `rm .ai/knowledge-base/nodes/map/map-adapter-interface.md`. Then sweep `rg -n "map-adapter-interface" .ai/knowledge-base/` and remove the id from any remaining `relates_to` arrays (it appears in `practice-v1-claude-code-only.md`, already handled in step 1).

3. **Regenerate INDEX/GRAPH**: run `node dist/cli.js index rebuild` (or `npx tsx src/cli.ts index rebuild`, depending on how the CLI is invoked in this repo) to refresh `.ai/knowledge-base/INDEX.md` and `.ai/knowledge-base/GRAPH.md` so they no longer reference the deleted map node and any updated tags/relates_to.

4. **CHANGELOG entry**: append a new bullet (or set of bullets) under `## Unreleased > ### BREAKING CHANGES` (above the existing entries). Keep the tone consistent with the existing breaking-changes bullets. Example skeleton (rewrite to fit, do not copy verbatim if the surrounding style differs):
   ```md
   * Removed several speculative abstractions and dead fields. No user action is required; existing on-disk artifacts with extra fields parse cleanly under the new schemas (Zod ignores unknown keys).
       * `src/adapters/` is gone. `writeHookConfig` is now the free function `writeClaudeHookConfig` in `src/lib/hooks-config.ts`; subprocess spawning goes through `runHeadlessClaude` from `src/lib/headless.ts` directly.
       * `NodeFrontmatterSchema.depends_on` removed. `GRAPH.md` no longer renders a `depends_on` line.
       * `SessionLogFrontmatterSchema.topics` removed. Rendered session logs no longer include a `topics:` line.
       * `RoleTaggedTranscript` shrunk to a single `interleaved` field; the parallel `user` and `agent` arrays are gone.
       * The unused `packageName()` export from `src/lib/version.ts` is removed.
   ```

5. **Verify**:
   - `rg -n "Adapter\\b|map-adapter-interface|ClaudeAdapter" .ai/knowledge-base/nodes/` returns no hits.
   - Run lint via the CLI (`node dist/cli.js lint` or equivalent) and confirm no `dangling-edge` errors.
   - `npm test` exits 0 (the regenerated INDEX/GRAPH may be touched by any test that snapshots them; confirm those still pass).

</details>
