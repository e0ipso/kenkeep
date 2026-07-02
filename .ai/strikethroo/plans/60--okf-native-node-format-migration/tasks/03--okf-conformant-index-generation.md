---
id: 3
group: "index-metadata"
dependencies: [1, 2]
status: "pending"
created: 2026-07-02
skills:
  - typescript
complexity_score: 5
complexity_notes: "Reserved-file conformance rules change what index.md may contain; the progressive-disclosure body must be preserved unchanged while all diagnostics move out."
---
# Generate OKF-conformant reserved index files

## Objective
Make `generateIndex` / index rebuild emit strict-OKF reserved index files:
ordinary `nodes/**/index.md` files carry no frontmatter, only the bundle-root
`nodes/index.md` carries `okf_version: "0.1"`, and folder summaries are read from
the sidecar (task 2) rather than reserved-file frontmatter — while keeping the
existing progressive-disclosure body structure and deterministic rebuild.

## Skills Required
- **typescript** — edit index generation and its frontmatter handling.

## Acceptance Criteria
- [ ] `generateIndex` emits ordinary folder `index.md` files with **no** YAML frontmatter.
- [ ] The bundle-root `nodes/index.md` frontmatter contains exactly `okf_version: "0.1"` and nothing else.
- [ ] `IndexFrontmatterSchema` (or its replacement) no longer stores `schema_version`/`nodes_hash`/`node_count`/folder `summary` in reserved index files; folder summaries are pulled from the sidecar.
- [ ] Kenkeep generated-artifact diagnostics continue to be emitted to `ENTRY.md`/`GRAPH.md` (kenkeep-owned artifacts), not to reserved index files.
- [ ] Verification: run the index rebuild twice on a fixture tree; the second run is byte-identical (no-op). Assert via a vitest and via `git diff --exit-code` after the second run. Expected: exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File: `src/lib/index-gen.ts` (`generateIndex`, `IndexFrontmatterSchema`, the
  rebuild entrypoint).
- Root vs non-root index files must be distinguished by bundle-root path.
- Determinism contract preserved: pure generation, no clock/randomness.

## Input Dependencies
- Task 1: v3 field names when index bodies list nodes.
- Task 2: folder-summary sidecar accessors for branch descriptions.

## Output Artifacts
- OKF-conformant generated indexes consumed by session-start/readers (task 5)
  and rebuilt by the migration step (task 6).

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. In `src/lib/index-gen.ts`, locate `generateIndex` and the point where it
   stamps `IndexFrontmatterSchema` data onto `index.md`.
2. For ordinary folder indexes: emit body-only markdown (the same
   progressive-disclosure listing as today) with NO frontmatter block.
3. For the bundle-root `nodes/index.md`: emit frontmatter containing only
   `okf_version: "0.1"`, then the body.
4. Source folder-summary/branch-description text from `readFolderSummaries`
   (task 2) rather than from prior index frontmatter.
5. Move any staleness/diagnostic fields (`nodes_hash`, `node_count`) that used to
   live in index frontmatter into the `ENTRY.md`/`GRAPH.md` generated artifacts
   (kenkeep-owned, outside the reserved-file conformance rule).
6. Keep generation pure. Add/adjust a vitest asserting: ordinary index has no
   frontmatter, root index has only `okf_version`, and a double rebuild is
   byte-identical.
</details>
