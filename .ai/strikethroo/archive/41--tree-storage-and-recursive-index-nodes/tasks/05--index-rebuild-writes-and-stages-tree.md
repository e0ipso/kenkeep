---
id: 5
group: "generator"
dependencies: [4]
status: "completed"
created: 2026-06-05
skills:
  - typescript
---
# Wire index rebuild (and --stage) to write and stage the full per-folder tree

## Objective
Update the `index rebuild` command (`src/commands/index-rebuild.ts`) so it
consumes the new recursive generator output and writes one `index.md` per
folder under `nodes/`, plus the root `GRAPH.md`. The `--stage` variant must
`git add` the full set of generated files. Also regenerate the bundled starter
nodes under `src/templates-source/kenkeep/nodes/` into the new topical-tree
layout so a fresh `init` is correct.

## Skills Required
- **typescript**: update the command orchestration that calls the generator and
  writes/stages files.

## Acceptance Criteria
- [ ] `index rebuild` writes an `index.md` into every folder under `nodes/`
  using the per-folder bodies returned by the recursive generator, and writes
  `GRAPH.md` at the root.
- [ ] `index rebuild --stage` stages (`git add`) every generated file it wrote
  (all `index.md` files and `GRAPH.md`).
- [ ] Running `index rebuild` twice over an unchanged leaf set produces no git
  diff on the second run (byte-identical regeneration).
- [ ] The bundled starter nodes under `src/templates-source/kenkeep/nodes/` are
  reorganized into the new topical-folder tree (leaves in topical folders, no
  reliance on `<kind>/` placement) so a fresh `init` yields a valid tree with
  an `index.md` in every folder.
- [ ] `npm run typecheck` passes; `node dist/cli.js index rebuild` runs against
  a fixture KB without error.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
The command previously wrote a single `INDEX.md`; it now iterates the
generator's per-folder result and writes each body to
`nodes/<dir>/index.md`. Staging must cover the full generated set so the
pre-commit recipe (`index rebuild --stage`) leaves a clean, complete tree.
Determinism must hold end to end: the second rebuild is a no-op diff.

## Input Dependencies
- Task 4: the recursive generator returning per-folder bodies and the shared
  hash/count, plus per-folder metrics.

## Output Artifacts
- Updated `src/commands/index-rebuild.ts` writing/staging the full tree.
- Reorganized `src/templates-source/kenkeep/nodes/` starter content in the new
  layout.

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Read `src/commands/index-rebuild.ts` and find where it calls `generateIndex`
   / `writeIndex` and `generateGraph` / `writeGraph`. Replace the single-index
   write with iteration over the generator's per-folder result: for each
   directory entry, write its body to `nodes/<dir>/index.md` (root dir writes
   `nodes/index.md`). Continue writing `GRAPH.md` at the KB root.
2. For `--stage`, collect the list of every file written and `git add` all of
   them (reuse whatever staging helper the command already uses for the single
   file; extend it to the full set).
3. Ensure write paths use the project's atomic write / `fs-atomic` helpers if
   the command already does so; otherwise match the existing write style.
4. Reorganize `src/templates-source/kenkeep/nodes/` from the current `map/` and
   `practice/` buckets into topical folders. Keep each leaf's frontmatter
   intact (including `kind`), bump each leaf's `schema_version` to match task 1,
   place leaves into topical folders, and run `index rebuild` to generate the
   `index.md` files for the new layout. Confirm every folder ends up with an
   `index.md`.
5. Build (`npm run build`) and run `node dist/cli.js index rebuild` twice
   against a fixture; confirm `git status` shows no diff on the second run.
6. Run `npm run typecheck`.

Golden-file test updates for the recursive layout are task 6; documentation
updates are task 7.
</details>
