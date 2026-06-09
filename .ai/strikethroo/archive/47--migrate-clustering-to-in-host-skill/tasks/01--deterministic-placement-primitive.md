---
id: 1
group: "deterministic-primitive"
dependencies: []
status: "completed"
created: 2026-06-09
skills:
  - typescript-node-cli
complexity_score: 7
complexity_notes: "New two-mode CLI command group plus relocation of two validation helpers and the version-chain consumer out of the deleted command; must preserve the abort-before-write ordering exactly."
---
# Build the deterministic LLM-free placement primitive (inventory + apply modes)

## Objective
Create a new deterministic, LLM-free CLI command group — mirroring the
`rebalance trigger` / `rebalance move` precedent — that owns the file half of
the v1->v2 migration. It exposes two modes: a read-only **inventory** mode that
detects the on-disk schema version and, when migration is due, emits the flat
leaves as JSON for the in-host skill to cluster (and reports "nothing to do"
when already current); and an **apply** mode that reads a placement-and-folders
JSON document from stdin, runs the existing validation guards against the real
leaves *before any write*, relocates the leaves with ids and bytes preserved,
and stamps the authored folder summaries. The version-chain machinery
(`detectSchemaVersion`, `planMigration`, `MigrationStep`) is consumed here so it
has a clear owner after the `migrate` command is deleted.

## Skills Required
- `typescript-node-cli`: TypeScript/Node CLI authoring with `commander`, Zod
  validation, stdin reading, deterministic atomic file I/O, and the project's
  "never invoke git" discipline.

## Acceptance Criteria
- [ ] A new command file under `src/commands/` implements two exported run
      functions (one per mode) following the structure of
      `src/commands/rebalance.ts`.
- [ ] The command group is registered in `src/cli.ts` with two subcommands,
      named per the `rebalance` precedent (a deterministic primitive group with
      a read/inventory subcommand and an apply subcommand).
- [ ] **Inventory mode**: detects the schema version via `detectSchemaVersion`;
      when a migration step is due it writes the flat-leaf inventory (from
      `readAllNodesFlat`) as JSON to stdout using `process.stdout.write` (no
      `log` prefix that would corrupt JSON); when the KB is already current or
      absent it reports "nothing to do" and exits 0.
- [ ] **Apply mode**: reads a placement-and-folders JSON document from stdin
      (using the shared `readStdin` helper, matching `rebalance move`), parses it
      with a Zod schema of the same shape the clustering produces today
      (`{"placements":[{"id","targetFolder"}],"folders":[{"folder","summary"}]}`),
      runs `reconcilePlacements` and the `reconcileFolderSummaries` orphan guard
      against the leaves read from disk, then `writePlacements`, then stamps each
      authored folder summary via `stampFolderSummary`.
- [ ] The abort-before-write ordering is preserved: both reconcile guards run
      **before** `writePlacements`, so an orphan/unknown-id/omitted-id plan makes
      zero filesystem changes and exits non-zero with a clear message.
- [ ] `reconcilePlacements` and `reconcileFolderSummaries` are relocated out of
      `src/commands/migrate.ts` into a module the new primitive imports (e.g. a
      `src/lib/migrate-*.ts` module), with their behavior and comments intact.
- [ ] No model call, no `execFileSync`, no `-p` spawn anywhere in the new code.
- [ ] `tsc --noEmit`, `eslint .`, and `prettier --check .` pass for the new and
      changed files.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Language/runtime: TypeScript compiled by `tsup`; ESM with `.js` import
  specifiers.
- CLI: `commander`, registered in `src/cli.ts`. Use `.allowExcessArguments(true)`
  on the subcommands as `rebalance` does, and `process.exit(code)` in the action.
- Reuse, do not reimplement:
  - `detectSchemaVersion`, `planMigration`, `MigrationStep` from
    `src/lib/migrate.ts` (the version-chain; consumed here as its new home).
  - `readAllNodesFlat`, `FlatLeaf` from `src/lib/migrate-read.ts`.
  - `writePlacements`, `Placement` from `src/lib/migrate-flat-to-tree.ts`.
  - `stampFolderSummary` from `src/lib/nodes.ts`.
  - `runIndexRebuild` is NOT called here — the index rebuild is the skill's final
    step (the skill calls `npx kenkeep index rebuild`), matching how curate drives
    `rebalance move` then a separate rebuild. Confirm against the plan's flow
    diagram: apply -> (skill triggers) index rebuild.
  - `readStdin` from `src/lib/stdin.js`; `findRepoRoot`, `repoPaths` from
    `src/lib/paths.js`; `log` from `src/lib/log.js`.
  - `NODE_SCHEMA_VERSION` from `src/lib/schemas.js`.
- The JSON contracts are machine-readable: emit them with `process.stdout.write`,
  never `log.*` (which adds prefixes/color).

## Input Dependencies
None. This is the foundational task; it relocates existing helpers and wires new
command surface, all from code that exists today.

## Output Artifacts
- A new `src/commands/<primitive>.ts` exporting the two mode run-functions.
- The relocated `reconcilePlacements` / `reconcileFolderSummaries` helpers in a
  lib module importable by both this primitive and (transitionally) anything
  still referencing them until Task 3 deletes the old command.
- CLI registration in `src/cli.ts`.
- The placement-and-folders JSON contract (inventory output shape and apply
  input shape) that Task 2 (the skill) and Task 5 (the tests) consume.

## Implementation Notes
Follow the `rebalance` precedent closely — it is the canonical "deterministic
primitive driven by an in-host skill" pattern this plan explicitly mirrors. The
naming should follow that precedent (a primitive command group with two
subcommands). Keep the command-group description in the same "Deterministic,
LLM-free …" voice used for `rebalance` in `src/cli.ts`.

<details>
<summary>Detailed implementation guidance</summary>

**Read first** (in this order): `src/commands/rebalance.ts` (the structural
template), `src/commands/migrate.ts` lines 103-199 (the `flatToTreeStep` body
and the two reconcile functions you are relocating), `src/lib/migrate.ts` (the
version chain), `src/lib/migrate-read.ts` (`readAllNodesFlat`/`FlatLeaf`),
`src/lib/migrate-flat-to-tree.ts` (`writePlacements`/`Placement`), and the
`rebalance` registration block in `src/cli.ts` (lines ~190-215).

**1. Relocate the two guards.** Move `reconcilePlacements` (migrate.ts 146-163)
and `reconcileFolderSummaries` (migrate.ts 177-199) verbatim — including their
doc comments — into a lib module the primitive imports. A natural home is a new
`src/lib/migrate-place.ts` (or extend `src/lib/migrate-flat-to-tree.ts`, which
already owns `writePlacements` and `Placement`). Export both. Do not change their
logic; they already throw on unknown id, omitted leaf, and orphaned folder
summary. Task 3 will delete the copies left in `migrate.ts`; for this task it is
acceptable for `migrate.ts` to import them from the new home (so the codebase
keeps compiling between tasks) — prefer that over duplicating.

**2. Define the apply-input schema.** Reuse the exact shape the clustering
produces today, from migrate.ts `PlacementResponseSchema` (lines 214-229):
```
{ placements: [{ id: string(min 1), targetFolder: string }],
  folders?: [{ folder: string(min 1), summary: string }] }
```
Parse stdin with it (Zod `.parse`, wrapped in try/catch that logs a clear error
and returns exit 1, exactly as `rebalance move` does at lines 79-85). Convert
`placements` to `Placement[]` with `sourcePath: ''` (filled by
`reconcilePlacements`), and fold `folders` into a
`folderSummaries: Record<string,string>` dropping blank summaries — mirror
`parsePlacements` (migrate.ts 267-281) minus the `extractJsonPayload`/harness
bits (the skill hands clean JSON; no LLM-output extraction needed here).

**3. Apply-mode order (critical — preserves the abort-before-write guarantee).**
```
const paths = repoPaths(findRepoRoot());
const leaves = readAllNodesFlat(paths.nodesDir);
const placements = reconcilePlacements(leaves, proposed);   // throws -> abort
reconcileFolderSummaries(folderSummaries, placements);      // throws -> abort
const results = writePlacements(paths.nodesDir, placements);// first write
for (const [folder, summary] of Object.entries(folderSummaries)) {
  if (folder.trim() === '') continue;
  stampFolderSummary(paths.nodesDir, folder, summary);
}
```
Wrap the reconcile+write in try/catch; on throw, `log.error(message)` and return
a non-zero code WITHOUT having written (the guards throw before `writePlacements`,
and `writePlacements` itself is all-or-nothing per its own pre-pass). Print the
per-leaf `id -> folder` report lines (see migrate.ts 134-136) and/or a JSON
summary on stdout — match `rebalance move`'s "structural summary JSON on stdout"
convention if you emit machine-readable output.

**4. Inventory mode.** 
```
const current = detectSchemaVersion(paths.nodesDir);
if (current === null) { log.plain('No knowledge base found under nodes/; nothing to do.'); return 0; }
if (current >= NODE_SCHEMA_VERSION) { log.plain(`...already at schema_version ${current}; nothing to do.`); return 0; }
// migration due: emit the flat leaves as JSON for the skill to cluster
const leaves = readAllNodesFlat(paths.nodesDir);
process.stdout.write(`${JSON.stringify({ leaves })}\n`);
return 0;
```
You may also surface the planned step(s) via `planMigration(buildSteps(), current,
NODE_SCHEMA_VERSION)` if useful, but the minimum contract is: detect + emit
leaves JSON when due, "nothing to do" otherwise. Keep the leaf JSON to the fields
`FlatLeaf` carries (id, title, kind, tags, summary, relates_to) so the skill
clusters validated data and never parses frontmatter itself (this is the
mitigation for the "skill mishandling leaf frontmatter" risk in the plan).

**5. Register in `src/cli.ts`.** Copy the `rebalanceGroup` block shape: a parent
`.command('<name>').description('Deterministic, LLM-free …')`, then two
`.command('<sub>')` children with `.allowExcessArguments(true)`, `--input
<path>` on the apply subcommand (so a file can be passed instead of stdin, like
`rebalance move`), and `process.exit(code)` actions. Import the two run-functions
at the top alongside the other command imports.

**6. Guardrails.** No `execFileSync`, no `'-p'`, no harness resolution, no
`extractJsonPayload`, no Zod-import of harness registry. This module must be pure
deterministic Node. Never call git.
</details>
