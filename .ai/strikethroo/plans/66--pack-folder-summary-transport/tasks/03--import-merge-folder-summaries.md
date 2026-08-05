---
id: 3
group: "pack-transport"
dependencies: [2]
status: "pending"
created: 2026-08-05
skills:
  - typescript
  - nodejs
complexity_score: 6
complexity_notes: "Merge must be correctly ordered against the index rebuild and correctly re-keyed; a mis-ordered write silently reproduces the original bug."
execution_profile: "complex-architecture"
---
# Merge the pack registry into the consumer on `pack import`

## Objective

Make `pack import` read the pack's folder summary registry, re-key every entry under the destination branch name (honoring `--as`), and merge it into the consumer's registry in a single write **before** the index rebuild runs — so the rebuild renders the pack author's routing text. Also surface `validatePack` warnings on the success path and remove the unreachable v2 frontmatter guard.

## Skills Required

- **typescript** — editing `src/commands/pack-import.ts`.
- **nodejs** — filesystem read/merge/write ordering against an existing rebuild step.

## Acceptance Criteria

- [ ] `runPackImportCommand` reads the pack registry from the pack's `knowledge/` directory and merges the re-keyed entries into the consumer registry with **exactly one** `writeFolderSummaries` call.
- [ ] Re-keying is a prefix join under `destinationName`: the pack's root key `''` maps to `<dest>`, and `apis` maps to `<dest>/apis`. Nested keys such as `a/b/c` map to `<dest>/a/b/c`.
- [ ] `--as <name>` re-keys under the renamed branch, using the already-resolved and pattern-validated `destinationName` from `src/commands/pack-import.ts:70-76`.
- [ ] `manifest.summary` remains authoritative for the `<dest>` key and overrides any pack root (`''`) entry.
- [ ] The merge completes **before** `runIndexRebuild()` is called (`src/commands/pack-import.ts:123`).
- [ ] Pre-existing consumer keys under the `<dest>/` prefix are overwritten (last-write-wins); consumer keys outside that prefix are preserved untouched.
- [ ] A pack with no registry imports successfully, exits `0`, and produces no error.
- [ ] `validatePack` warnings are printed on the **successful** validation path, not only on the failure branch at `src/commands/pack-import.ts:63-68`.
- [ ] The `nodes/<dest>/index.md` frontmatter guard in `ensureDestinationSummary` (`src/commands/pack-import.ts:219-222`) is removed.
- [ ] Runnable verification: `npx tsc --noEmit` from `/workspace` exits `0`.
- [ ] Runnable verification: `npm run build`, then in a scratch dir run `mkdir /tmp/kk-t3 && cd /tmp/kk-t3 && git init && node /workspace/dist/cli.js init --harnesses claude`, then `node /workspace/dist/cli.js pack import <a-pack-exported-by-task-1> --as vendor`. Expected: exit `0`, no "folder(s) have no summary" warning, and `/tmp/kk-t3/.ai/kenkeep/FOLDER_SUMMARIES.md` containing `vendor` plus a `vendor/<sub>` key per exported subfolder with the pack's authored text.
- [ ] Runnable verification: `/tmp/kk-t3/.ai/kenkeep/nodes/vendor/index.md` descent pointers render the authored routing sentence and its `read when …` clause, not a Title-cased folder name.
- [ ] Clean up `/tmp/kk-t3` when done.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Edit only `src/commands/pack-import.ts`.
- Use `readFolderSummaries` and `writeFolderSummaries` from `src/lib/folder-summaries.ts`. Do not parse frontmatter directly.
- Do not use `setFolderSummary` or `stampFolderSummary` per key — each is a full read-modify-write of the entire file (`src/lib/folder-summaries.ts:67-74`).

## Input Dependencies

- Task 2 — `validatePack` must already reject traversal-escaping keys and schema-invalid registries, so this merge can assume every surviving key is safe to prefix-join. Do not re-implement key-escape validation here.

## Output Artifacts

- `pack import` landing the pack's authored routing text in the consumer registry ahead of the index rebuild.
- Visible `validatePack` warnings on successful imports.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

**Current call site.** In `runPackImportCommand`, `src/commands/pack-import.ts:121-124` reads:

```
    ensureDestinationSummary(paths.nodesDir, destinationName, validation.manifest.summary);

    const rebuildCode = await runIndexRebuild();
    if (rebuildCode !== 0) return rebuildCode;
```

Replace the `ensureDestinationSummary` call with the merge described below. It must stay on the same side of `runIndexRebuild()` — before it.

**Why ordering is load-bearing.** `runIndexRebuild` calls `generateIndex`, which calls `harvestFolderSummaries`, which reads the sidecar off disk via `readFolderSummaries(nodesDir)` at `src/lib/index-gen.ts:475`. A merge written *after* the rebuild is invisible until some later rebuild — which silently reproduces the exact bug this plan fixes. Do not move the merge below line 123, and do not add a second rebuild.

**The merge.**

1. Resolve the pack registry from `knowledgeDir` (already computed at line 99 as `join(acquired.packRoot, PACK_KNOWLEDGE_DIRNAME)`). Call `readFolderSummaries(knowledgeDir)` — it resolves `<packRoot>/knowledge.FOLDER_SUMMARIES.md` via `folderSummariesFileForNodesDir` and returns an empty `Map` when the file is absent (`src/lib/folder-summaries.ts:23-33`). That empty-map behavior *is* the backwards-compatibility path; do not add a separate existence check or an error branch for a missing registry.
2. Read the consumer registry: `readFolderSummaries(paths.nodesDir)`.
3. Build the merged map: start from the consumer map, then for each pack entry `[key, value]` set `mergedKey = key === '' ? destinationName : `${destinationName}/${key}`` to `value`. Because you iterate the pack entries last, pre-existing consumer keys under the `<dest>/` prefix are overwritten — this is the intended last-write-wins semantics. It matters because the on-disk registry is never pruned (`harvestFolderSummaries` prunes only its in-memory copy at `src/lib/index-gen.ts:478-481`), so stale keys can survive a branch removal and must not win over the incoming pack.
4. Set `merged.set(destinationName, validation.manifest.summary)` **after** the pack entries, so `manifest.summary` overrides any pack root (`''`) entry. This preserves today's behavior and keeps the existing assertion at `tests/commands/pack-import.test.ts:255-270` green.
5. Call `writeFolderSummaries(paths.nodesDir, merged)` exactly once.

`destinationName` is already resolved from `opts.as ?? validation.manifest.name` and validated against `PACK_NAME_PATTERN` at lines 70-76, so renaming is handled by construction. Nested keys need no special handling — a plain string join is correct.

**Surfacing warnings on the success path.** At `src/commands/pack-import.ts:63-68`, warnings are only printed inside the `if (!validation.ok || !validation.manifest)` block. After that block, add a loop printing `validation.warnings` through `log.warn`. Without this, every warn-level check task 2 added is invisible — the same silent-failure class this whole plan exists to fix.

**Removing the dead guard.** `ensureDestinationSummary` at `src/commands/pack-import.ts:213-224` checks `nodes/<dest>/index.md` frontmatter for a `summary` key before stamping. That guard is unreachable under schema version 3: ordinary index files carry no frontmatter and lint forbids it (`src/lib/lint.ts:245-253`). Since the merge above now handles the destination key directly, delete the whole `ensureDestinationSummary` function and its call. Then remove any imports left unused by that deletion — check `matter` (line 15), `INDEX_FILENAME`, and `stampFolderSummary` (lines 20-26), and remove only those that no longer have another use in the file. `readFileSync` and `existsSync` are used elsewhere in the module; verify before removing anything. `npx tsc --noEmit` plus the repo lint will catch an unused import.

**Explicitly out of scope for this task.**

- Do not re-validate key escapes here; task 2 owns that, and doing it mid-merge risks a partially written consumer registry.
- Do not change the "destination branch already exists" abort at lines 91-97 into a merge. That is a different feature with its own conflict semantics.
- Do not modify `src/lib/pack.ts`, `src/lib/folder-summaries.ts`, `src/lib/index-gen.ts`, or `src/commands/index-rebuild.ts`.
- Do not write tests here; task 4 owns the test surface.
- Do not add a v2 `index.md`-frontmatter summary fallback anywhere.

</details>
