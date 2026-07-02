---
id: 5
group: "readers"
dependencies: [1, 2]
status: "pending"
created: 2026-07-02
skills:
  - typescript
complexity_score: 6
complexity_notes: "Wide read surface; a missed reader produces silent breakage, and the v2 rejection must fire on two distinct entry paths."
---
# Switch readers to v3 fields and reject schema_version 2

## Objective
Update every node-reading path (`nodes.ts` read, session-start injection,
prompt-time retrieval, GRAPH/ENTRY generation) to consume the v3 field names and
pull index freshness/folder-summary state from the sidecar rather than reserved
index frontmatter, and make readers reject `schema_version: 2` trees with an
actionable message pointing at the migrate command — on both the init path and
the node-read path.

## Skills Required
- **typescript** — edit the reader modules and rejection surfacing.

## Acceptance Criteria
- [ ] `src/lib/nodes.ts` read, `src/lib/session-start.ts`, `src/lib/prompt-retrieval.ts`, and GRAPH/ENTRY generation read v3 fields (`type`, `description`, `kk_*`).
- [ ] Index readers no longer depend on `nodes/**/index.md` frontmatter for freshness or folder summaries; they use the sidecar (task 2) and the `ENTRY.md`/`GRAPH.md` artifacts.
- [ ] Reading or initializing a `schema_version: 2` tree fails with a message naming the migrate command, on BOTH the init path and a node-read path.
- [ ] A `schema_version: 3` (`kk_schema_version: 3`) tree is accepted.
- [ ] Verification: point a reader at a committed v2 fixture and run `npx kenkeep --harness claude init` and a node-read command; both exit non-zero and print the migrate pointer. Point them at a v3 fixture; both succeed. Capture both outputs.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `src/lib/nodes.ts`, `src/lib/session-start.ts`,
  `src/lib/prompt-retrieval.ts`, GRAPH/ENTRY generation (in `index-gen.ts` or its
  callers), plus the init entrypoint that validates on-disk version.
- Rejection reuses the existing version-mismatch surfacing practice.

## Input Dependencies
- Task 1: v3 schema/field names.
- Task 2: sidecar accessors for index freshness and folder summaries.

## Output Artifacts
- v3-aware readers exercised by the dogfood validation (task 9).

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. Grep for the v2 field names (`\.kind`, `\.summary`, `schema_version`) across
   the reader modules and replace with `type` / `description` / `kk_schema_version`.
2. In session-start and prompt-retrieval, ensure previews route on `description`
   and routing on `type`.
3. Replace any reads of `nodes/**/index.md` frontmatter for freshness/summaries
   with `readFolderSummaries` (task 2) and the `ENTRY.md`/`GRAPH.md` diagnostics.
4. Locate the on-disk version validation used by init and node-read. Add a guard:
   if the detected version is 2, throw/emit the existing actionable
   version-mismatch message that names the migrate command. Ensure it fires on
   both the init path and at least one node-read path.
5. Build a small committed v2 fixture and a v3 fixture (temp trees in the test
   suite) and add a vitest asserting rejection on v2 and acceptance on v3 for
   both paths.
</details>
