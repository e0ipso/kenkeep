---
id: 2
group: "deterministic-core"
dependencies: [1]
status: "completed"
created: 2026-06-05
skills:
  - typescript
complexity_score: 7
complexity_notes: "The riskiest deterministic surface: applies the four structural moves as content-byte-stable git renames so the diff records R entries, keeps ids stable so no referencing file is rewritten, mints new ids plus a redirect only on split-leaf, and then drives Plan 1's deterministic rebuild of the affected index nodes and nodes_hash. Byte stability and id stability are the load-bearing invariants."
---
# Deterministic move primitive: id-stable, content-byte-stable git renames + rebuild

## Objective
Add a deterministic primitive in `src/commands/` that, given a structural
operation and its affected branch(es), applies the move on disk so that:
file content is preserved byte-for-byte (git records a rename, not delete+add),
ids stay stable across moves so no referencing file is rewritten, and split leaf
mints new ids for its parts and leaves a redirect for the old id. After applying
moves it invokes Plan 1's deterministic rebuild to regenerate the affected
`index.md` nodes and `nodes_hash`. It performs no LLM reasoning: the clustering
decision is supplied by the caller (Task 3); this primitive only executes it
deterministically.

## Skills Required
- `typescript`: implement content-preserving file relocations (read bytes,
  write to new path unchanged, remove old path) for the four operations, reusing
  the existing `ensureUniqueId` mint and Plan 1's rebuild, with atomic writes.

## Acceptance Criteria
- [ ] Implements the four operations on affected branches only: **split folder** (cluster children into subfolders), **split leaf** (a document becomes a folder of an index node plus two or more documents), **merge** (collapse a sparse or redundant branch), **create branch** (a new top-level topic folder).
- [ ] Relocation preserves file content byte-for-byte: a moved leaf's bytes are identical before and after, so `git diff --summary` records an `R` (rename) entry rather than a delete plus add.
- [ ] Ids are stable across split folder, merge, and create branch: a relocated leaf keeps its id, its filename stem, and every cross reference; no referencing file is rewritten by the move.
- [ ] Split leaf mints new ids for the new sub-documents using the existing `ensureUniqueId` mint, and records a redirect from the old id (in history per the plan) so cross references to the old id still resolve.
- [ ] After moves, the primitive invokes Plan 1's deterministic rebuild for the affected folders only, regenerating their `index.md` nodes and `nodes_hash`; the regeneration is byte-stable (running rebuild again is a no-op).
- [ ] Every move and rebuild leaves changes uncommitted in the working tree (no `git commit`, no `git add` required by the primitive); the human accepts by commit and rejects by path-scoped restore.
- [ ] An invalid or out-of-tree target (absolute path or `..` traversal) is rejected with a clear error and nothing is moved.
- [ ] No em dashes in any changed file.
- [ ] `npm run typecheck` and `npm run lint` pass for the changed files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- File(s) to add/modify: a new move primitive under `src/commands/` plus helpers
  under `src/lib/` (path resolution, content-preserving relocation, redirect
  recording).
- Relocation must move bytes verbatim. Do not reserialize frontmatter on a pure
  relocation (reserialization would change bytes and break the rename detection
  and the byte-stability invariant). Only split leaf, which creates new files,
  serializes new content.
- Reuse the existing `ensureUniqueId` mint (referenced in the plan's risk
  section) for split-leaf sub-ids; do not roll a new id generator.
- Drive Plan 1's existing deterministic rebuild for the affected folders; do not
  reimplement index generation.
- The primitive executes a caller-supplied operation plan deterministically; it
  does not call an LLM and does no clustering judgment of its own.
- No em dashes in changed files (`practice-no-em-dashes`).

## Input Dependencies
- Task 1: the trigger's structured decision shape (which branch, which operation
  class) defines the input contract this primitive executes.
- Plan 1: tree storage, `ensureUniqueId`, and the deterministic rebuild.

## Output Artifacts
- A deterministic `rebalance` move primitive under `src/commands/` applying the
  four operations as content-byte-stable, id-stable git renames.
- Split-leaf id-mint + redirect behavior.
- Post-move deterministic rebuild of affected `index.md` + `nodes_hash`.
- The move contract consumed by Task 3 (skill wiring) and Task 4 (tests).

## Implementation Notes
<details>
<summary>Step-by-step</summary>

1. Read how Plan 1 stores leaves and index nodes and how its rebuild
   regenerates `index.md` and `nodes_hash` (search `src/lib/` and
   `src/commands/`). Identify the rebuild entrypoint you can call for a subset of
   folders.
2. Implement a content-preserving relocate helper: read the source file as bytes
   (Buffer), write those exact bytes to the destination via atomic tmp+rename,
   then remove the source. Never parse-then-reserialize on a relocation; that is
   what guarantees git sees a rename and the bytes are stable. Guard the
   destination to stay within `nodes/` (reject absolute / `..`).
3. Split folder: given a folder and a target subfolder grouping (supplied by the
   caller), relocate each child leaf into its subfolder via the byte-stable
   helper, keeping each id and filename stem unchanged.
4. Merge: relocate the leaves of a sparse/redundant branch into the merge target
   folder via the byte-stable helper, ids unchanged; remove the now-empty source
   folder.
5. Create branch: create a new top-level folder and relocate the designated
   leaves into it via the byte-stable helper, ids unchanged.
6. Split leaf: convert one document into a folder containing an index node plus
   two or more documents. The new sub-documents get new ids via the existing
   `ensureUniqueId` mint (uniquified over the whole tree). Record a redirect from
   the old id (per the plan, "leaves a redirect in history") so references to the
   old id resolve. This is the only operation that writes new content.
7. After applying the operation, call Plan 1's deterministic rebuild for the
   affected folders to regenerate their `index.md` and `nodes_hash`. Confirm a
   second rebuild is a no-op (byte stable).
8. Leave everything uncommitted. The primitive must not run `git add` or
   `git commit`.
9. Register the primitive in the CLI mirroring existing `src/commands/`
   registrations.
10. Run `npm run typecheck` and `npm run lint`. Do not hand-edit anything under
    `templates/`.
11. Record the command name, its input shape (how the caller specifies the
    operation and groupings), and the redirect format for Task 3 and Task 4.

</details>
