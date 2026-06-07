---
id: 1
group: "writer"
dependencies: []
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 5
complexity_notes: "Touches the writer primitive and the nodes lib path logic; identity must stay decoupled from placement so cross references never move."
---
# `node write` accepts a target home folder (presentation), id stays identity

## Objective
Teach the `node write` primitive and the underlying `writeNodeFile`/path helpers
in `src/lib/nodes.ts` to place a leaf into a caller-named **existing** home
folder under `nodes/`, while keeping the node id as the sole identity. Placement
is presentation only: the same id may live in any folder, and changing the
folder never changes the id, the filename stem, or any cross reference.

## Skills Required
- **typescript**: extend the `node-write` command flags and the `nodes.ts`
  path/write helpers with a target-folder parameter, preserving atomic
  tmp+rename and Zod validation.

## Acceptance Criteria
- [ ] `node write` accepts an optional target-folder argument (e.g. `--folder <relpath>`); when given a relative path under `nodes/`, the leaf is written into that folder as `<folder>/<id>.md`.
- [ ] When the folder argument is omitted or empty, the leaf lands at the `nodes/` root as a top-level leaf (`nodes/<id>.md`). This is the deliberate root fallback, not an error.
- [ ] The node id is derived and stamped exactly as today (from kind+title via `deriveNodeId`, with `ensureUniqueId` collision handling over the whole tree); the id is independent of the chosen folder.
- [ ] `writeNodeFile` (or a thin successor) writes to the resolved folder via atomic tmp+rename and returns the absolute path; frontmatter is still validated against `NodeFrontmatterSchema` before any disk write.
- [ ] A folder argument that escapes `nodes/` (absolute path or `..` traversal) is rejected with a clear error and no file is written.
- [ ] The writer never creates, splits, or merges branch/index structure; it only writes the single leaf file (creating the leaf's own parent directory if missing is acceptable since placement targets an existing folder).
- [ ] `npm run typecheck` and `npm run lint` pass for the changed files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
The current `writeNodeFile` in `src/lib/nodes.ts` hardcodes the target directory
as `join(nodesDir, validated.kind)` and the filename as
`nodeFilename(kind, id)`. After Plan 1, `kind` is a facet, not a directory, so
the writer must target a caller-named folder instead of `nodes/<kind>/`. Keep
the filename keyed on the id (`<id>.md`) so identity is stable across folders.
No em dashes in changed files (`practice-no-em-dashes`).

## Input Dependencies
- Plan 1 (tree storage and recursive index nodes) is assumed landed: `nodes/`
  is a folder tree and `kind` is a facet, not a directory.

## Output Artifacts
- Updated `src/lib/nodes.ts` (folder-aware write + path helpers).
- Updated `src/commands/node-write.ts` (new folder flag wired through).
- The folder-aware `node write` contract consumed by Task 3 (the curate skill)
  and Task 4 (integration tests).

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. In `src/lib/nodes.ts`, change `WriteNodeArgs` to carry an optional
   `folder?: string` (a path relative to `nodesDir`). In `writeNodeFile`,
   resolve the target directory as: if `folder` is set and non-empty,
   `join(nodesDir, folder)`; otherwise `nodesDir` (root fallback). Resolve the
   filename as `<id>.md` (id already carries no folder semantics). Keep the
   atomic tmp+rename and `mkdirSync(targetDir, { recursive: true })`.
2. Add a guard: after resolving the target dir, verify it stays within
   `nodesDir` (e.g. compute `relative(nodesDir, resolvedDir)` and reject if it
   starts with `..` or is absolute). Throw a clear error; do not write.
3. Note `nodeFilename(kind, id)` currently prefixes by kind. The leaf filename
   should be id-based and folder-independent. Either keep using the existing id
   (which already begins with `<kind>-`) as the stem, or add a folder-agnostic
   `nodeLeafFilename(id)` helper returning `<id>.md`. Do not let the folder
   leak into the filename.
4. In `src/commands/node-write.ts`, add an optional `folder` flag to
   `NodeWriteFlags` (CLI flag `--folder`), parse/trim it, and pass it through to
   `writeNodeFile` via `WriteNodeArgs.folder`. Keep the stdout contract intact:
   on success print ONLY the resolved id and a trailing newline. The id is
   still derived from kind+slug and uniquified over `readAllNodes(nodesDir)` so
   identity does not depend on the folder.
5. Empty/omitted `--folder` must route to the root fallback path
   (`nodes/<id>.md`). Add the rejection path for traversal/absolute folders.
6. Wire the new flag into the CLI argument registration wherever the other
   `node write` flags are declared (search the CLI entrypoint for the existing
   `node write` subcommand registration and mirror the pattern).
7. Run `npm run typecheck` and `npm run lint` on the touched files. Do not
   hand-edit anything under `templates/` (it is generated).
</details>
