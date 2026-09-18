---
id: 3
group: "loose-leaf-placement"
dependencies: [1]
status: "pending"
created: 2026-09-18
skills:
  - typescript
  - vitest
complexity_score: 6
complexity_notes: >
  Scored 6 and emitted whole rather than split. The command, the id-stable relocation it reuses,
  the delete rule, and the index rebuild are one behaviour with one JSON summary; splitting the
  CLI wiring from the logic would produce two units neither of which can be verified alone.
execution_profile: "complex-architecture"
---
# The node sweep command

## Objective

Add a standing CLI command that empties the `nodes/` root. It walks every leaf at the root, runs
the placement function over each, relocates the placeable ones with ids and bytes unchanged,
deletes the unplaceable ones, drives the deterministic index rebuild, and prints one JSON summary.
It never stages, commits, or restores.

## Skills Required

TypeScript for the command and the relocation reuse, Vitest for the sweep and delete-rule cases.

## Acceptance Criteria

- [ ] `npx kenkeep node sweep` is registered and documented in `--help` under the existing `node`
      command group.
- [ ] Run in this repository, it relocates all three root leaves: the copilot sessionstart leaf to
      `harnesses/`, the dogfooding leaf to `conventions/`, and the template-partials leaf to
      `config-and-prompts/`.
- [ ] The relocations are git renames. `git status --porcelain` shows `R` entries, the SHA-256 of
      each file is unchanged, and `.ai/kenkeep/nodes/.redirects.json` gains no entry.
- [ ] Folder `index.md` files, `ENTRY.md`, `GRAPH.md`, and `nodes_hash` are regenerated in the same
      run. After the sweep, `ENTRY.md` has no `## Conventions (how we build)` section and each
      destination `index.md` lists its new leaf.
- [ ] A root leaf with no edges and a tag appearing nowhere else is deleted, and the JSON summary
      names it with a reason. The file is recoverable with a path-scoped `git restore`.
- [ ] A tree with no folders deletes nothing and reports that it had nowhere to place.
- [ ] Running the command a second time reports nothing to do and leaves the tree byte-identical.
- [ ] The command writes only to the working tree. `git diff --cached` is empty after a run.
- [ ] `npx vitest run tests/commands/node-sweep.test.ts` exits 0, covering relocation, the delete
      rule, the no-folders guard, and the second-run no-op.
- [ ] `npm run typecheck` and `npm run lint` exit 0.

## Technical Requirements

Command name: `node sweep`, under the existing `node` group in `src/cli.ts` alongside `node add`
and `node write`. The plan left the name open. A bare top-level `sweep` says nothing about what it
sweeps, and `place` is already taken by the flat-to-tree migration primitive in
`src/commands/place.ts`. If the reviewer prefers a different name, it is a one-line change in
`src/cli.ts` plus the docs in Task 4.

Relocation reuses the content-preserving, id-stable move already implemented for rebalance rather
than adding a second relocation path. `relocateBytes` in `src/lib/rebalance-move.ts` is currently
module-private; export it, or lift it into a shared helper both modules import. Do not copy it.
Byte preservation is what makes git record a rename instead of a delete plus an add.

The index rebuild is `runIndexRebuild()` from `src/commands/index-rebuild.ts`, called with no
options so it never stages. `runRebalanceMove` in `src/commands/rebalance.ts` is the pattern to
follow, including its non-zero return when the rebuild fails.

Ids never change, so no redirect is recorded. Do not touch `src/lib/redirects.ts`.

The summary goes to `process.stdout.write`, not `log`, so no prefix or colour corrupts the JSON.
This matches `rebalance trigger` and `curate persist`.

## Input Dependencies

Task 1: the exported placement function and result type from `src/lib/leaf-placement.ts`.

## Output Artifacts

`src/commands/node-sweep.ts`, its registration in `src/cli.ts`, an exported relocation helper from
`src/lib/rebalance-move.ts`, and `tests/commands/node-sweep.test.ts`. Task 4 documents the command.

## Implementation Notes

Test philosophy for the test cases in this task: write tests for custom logic and algorithms,
critical workflows and data transformations, edge cases and error conditions in core
functionality, integration points between components, and complex validation or calculation logic.
Do not write tests for third-party library behaviour, simple CRUD without custom logic, trivial
getters and setters, static configuration, or anything that would break immediately if wrong.
Combine related scenarios into one test rather than one test per branch. Favour integration and
critical-path coverage over per-method unit tests.

<details>
<summary>Detailed implementation guidance</summary>

Create `src/commands/node-sweep.ts` modelled on `src/commands/rebalance.ts`:

```ts
export async function runNodeSweep(): Promise<number> {
  const root = findRepoRoot();
  const paths = repoPaths(root);
  if (!existsSync(paths.installedVersionFile)) {
    log.error('kenkeep is not initialized in this repo. Run `npx kenkeep init --harnesses <id[,id,...]>`.');
    return 1;
  }
  // ...
}
```

Read the tree once with `readAllNodes(paths.nodesDir)`. The root leaves are the entries with
`relDir === ''`. Sort them by `relPath` with `localeCompare` so the summary is stable.

For each root leaf, call the placement function with the whole leaf set and the leaf's own id as
`selfId`, so a leaf never scores tag overlap against itself.

Decide against the snapshot taken up front, then apply. Unlike `applyRebalancePlan`, which re-reads
per operation because each operation reshapes the tree, a sweep only moves leaves out of the root.
Relocating one root leaf does not change the folder of any other leaf, and it must not change
another root leaf's decision mid-run. Decide first, then move. Say that in a comment, because the
difference from `applyRebalancePlan` will otherwise look like an oversight.

Handle the results:

- `placed`: `relocateBytes(srcPath, join(nodesDir, folder, basename(srcPath)))`. Record
  `{ id, from, to, reason }` where `reason` is the `edges` / `tags` / `alphabetical` discriminator
  from Task 1.
- `unplaceable`: `rmSync(srcPath)`. Record `{ id, path, reason: 'no folder-resolving edges and no tag overlap with any folder' }`.
- `no-folders`: relocate nothing, delete nothing. This case must short-circuit the whole run before
  any write. A fresh or bootstrap-era tree has nowhere to place into, and it must never reach the
  delete rule.

Export `relocateBytes` from `src/lib/rebalance-move.ts`. It already guards against overwriting an
existing destination and against a missing source, and it writes through a tmp plus rename. Keep
the `nodes/` containment check by resolving the destination through the same `resolveFolder` logic,
or export that too. A destination the placement function returned is inside the tree by
construction, but the guard costs nothing.

Run `await runIndexRebuild()` after the moves and before the summary, and return its exit code on
failure with a message pointing at `git diff`, exactly as `runRebalanceMove` does.

Summary shape, one line on stdout:

```json
{"relocated":[{"id":"...","from":"...","to":"...","reason":"edges"}],"deleted":[{"id":"...","path":"...","reason":"..."}],"skipped":"no-folders"}
```

Omit or empty `skipped` on a normal run. When both arrays are empty the command has nothing to do;
still print the summary and exit 0, so the second-run no-op is observable.

Register in `src/cli.ts` on the existing `nodeGroup` (around line 400):

```ts
nodeGroup
  .command('sweep')
  .description('Deterministic, LLM-free sweep of the nodes/ root: relocates every loose leaf into the folder its own edges and tags name, deletes the ones that match nothing, and rebuilds the indexes. Writes files only; never stages or commits. Prints a JSON summary.')
  .action(async () => { process.exitCode = await runNodeSweep(); });
```

Match the surrounding registrations for how the exit code is set.

For the tests, `tests/commands/rebalance.test.ts` has the `writeLeaf` helper and a `gitCommitAll`
helper that inits a sandbox git repo. Reuse both. Cases:

1. Sandbox with `harnesses/` (two leaves tagged `harness`, `copilot`) and `hooks/` (two leaves
   tagged `hooks`), plus a root leaf edging to one leaf in each and tagged `harness`, `copilot`.
   Commit, sweep, assert the leaf moved to `harnesses/`, assert `git status --porcelain` starts
   with `R`, and compare the file's SHA-256 before and after.
2. Same sandbox, plus a root leaf with no edges and tag `nowhere-else`. Sweep, assert the file is
   gone, assert the summary's `deleted` array names it with a reason, then `git restore` the path
   and assert it is back.
3. Sandbox with leaves only at the root and no folders. Sweep, assert nothing was deleted and the
   summary reports the no-folders case.
4. After case 1, sweep again. Assert both arrays are empty and `git status --porcelain` is
   unchanged from the post-first-sweep state.

Assert `git diff --cached --name-only` is empty in at least one case, proving the command never
stages.

Run `npm run build` before the tests so `dist/cli.js` is current.

</details>
