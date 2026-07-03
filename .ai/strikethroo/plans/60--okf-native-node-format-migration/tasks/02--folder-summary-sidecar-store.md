---
id: 2
group: "index-metadata"
dependencies: []
status: "pending"
created: 2026-07-02
skills:
  - typescript
  - zod
complexity_score: 5
complexity_notes: "New committed sidecar store plus rewiring of the two existing folder-summary accessors and their rebalance/placement callers."
---
# Move folder-summary storage to a committed kenkeep sidecar

## Objective
Create a committed markdown sidecar (outside the `nodes/` OKF bundle) with a
Zod-validated shape that stores folder summaries keyed by POSIX folder path, and
rewire `harvestFolderSummaries` / `stampFolderSummary` and their rebalance and
v1→v2 placement callers to read and write that sidecar instead of
`nodes/**/index.md` frontmatter.

## Skills Required
- **typescript** — implement the sidecar module and update the accessor callers.
- **zod** — define and validate the folder-summary registry shape.

## Acceptance Criteria
- [ ] A new sidecar file (committed markdown under `.ai/kenkeep/`, e.g. a folder-summary registry keyed by POSIX folder path) has a Zod-validated schema.
- [ ] `harvestFolderSummaries` and `stampFolderSummary` in `src/lib/index-gen.ts` read/write the sidecar, not `nodes/**/index.md` frontmatter.
- [ ] `src/lib/rebalance-move.ts` and `src/lib/migrate-place.ts` (the v1→v2 placement primitive) read/write folder summaries through the sidecar accessors.
- [ ] Writing is deterministic: no clock, no randomness; identical input → byte-identical sidecar.
- [ ] Verification: a vitest that writes two folder summaries, reads them back, and asserts a byte-identical round-trip after two consecutive writes passes (`npx vitest run` for the new test). Expected: exit 0, green.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- New module (e.g. `src/lib/folder-summaries.ts`) exporting typed read/write
  functions and a Zod schema for the registry.
- Storage is committed plain markdown, diff-reviewable like the rest of the KB.
- Keying is POSIX folder path relative to the bundle root.

## Navigation Impact (scope clarification)
This task relocates the **storage / source of truth** for folder summaries only
(frontmatter → sidecar). It does NOT change how `index.md` drives progressive
disclosure:
- **Drilling into a sub-folder:** `generateIndex` still renders each child
  folder's summary into the parent index **body** as a descent pointer
  (`renderDescentPointer` in `src/lib/index-gen.ts`). The summary text the reader
  sees while navigating is unchanged; only its persisted copy moves from
  `index.md` frontmatter to the sidecar, which `harvestFolderSummaries` now reads
  from. Reserved `index.md` bodies remain the navigation vehicle (that generation
  work is task 3).
- **Loading a leaf:** unaffected by this task. Leaf shape is the schema-v3 concern
  of tasks 1/4/5; this task touches folder-level summaries only.
- **Leaf split (rebalance: 1 sub-folder + 1 index.md + 2 leaves):** the split op
  in `src/lib/rebalance-move.ts` authors the new folder's summary via
  `stampFolderSummary`. After this change that call persists to the sidecar
  instead of the new folder's `index.md` frontmatter; the split flow, its
  LLM-authored per-folder summary, and the subsequent self-preserving rebuild are
  otherwise unchanged. The generated `index.md` for the new folder becomes a
  frontmatter-free reserved file whose summary lives in the sidecar and is
  rendered into the parent's descent pointer.

## Input Dependencies
None — independent module; does not depend on the node schema.

## Output Artifacts
- The sidecar module and accessors consumed by index generation (task 3),
  readers (task 5), and the migration step (task 6).

## Implementation Notes
<details>
<summary>Executable guidance</summary>

1. Create `src/lib/folder-summaries.ts`. Define `FolderSummaryRegistrySchema`
   with Zod: a record/array keyed by POSIX folder path → summary string. Export
   `readFolderSummaries(root)` and `writeFolderSummaries(root, registry)` that
   (de)serialize to a committed markdown sidecar under `.ai/kenkeep/` (place it
   OUTSIDE `nodes/` so it is not part of the OKF bundle). Use the existing
   `fs-atomic.ts` helpers for writes.
2. Serialization must be deterministic: sort keys, stable formatting, no
   timestamps.
3. In `src/lib/index-gen.ts`, change `harvestFolderSummaries` to read prior
   summaries from the sidecar (via `readFolderSummaries`) instead of scanning
   `nodes/**/index.md` frontmatter, and `stampFolderSummary` to persist through
   `writeFolderSummaries`.
4. Update callers in `src/lib/rebalance-move.ts` and `src/lib/migrate-place.ts`
   to move/set summaries via the sidecar accessors rather than index frontmatter.
5. Add a vitest covering the round-trip and the two-consecutive-write
   determinism assertion.
</details>
