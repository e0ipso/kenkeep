---
id: 1
group: "pack-transport"
dependencies: []
status: "completed"
created: 2026-08-05
skills:
  - typescript
  - nodejs
complexity_score: 5
execution_profile: "standard-implementation"
---
# Emit the folder summary registry from `pack export`

## Objective

Make `pack export` ship the knowledge base's folder summary registry inside the pack, at the pack root as `knowledge.FOLDER_SUMMARIES.md`, pruned to the folders actually present in the exported tree, and warn the author about exported folders that have no summary.

## Skills Required

- **typescript** — editing `src/commands/pack-export.ts`, a TypeScript CLI command module.
- **nodejs** — directory walking and temp-directory staging with `node:fs`.

## Acceptance Criteria

- [x] `src/commands/pack-export.ts` writes the registry into the staged temp directory after `copyTree` and before the lint gate, using the existing `writeFolderSummaries` from `src/lib/folder-summaries.ts`.
- [x] The written entry set is pruned to folders that exist in the exported tree; no key names a folder absent from `knowledge/`.
- [x] Exported folders with no summary entry produce a warning on stderr; the command still exits `0`.
- [x] No new lint rule is added and `src/lib/lint.ts` is not modified.
- [x] Runnable verification: from `/workspace`, run `npm run build && node dist/cli.js pack export --name selftest --version 1.0.0 --summary "verification pack" --out /tmp/kk-t1-pack`. Expected: exit code `0`, and `ls -a /tmp/kk-t1-pack` lists `knowledge.FOLDER_SUMMARIES.md` beside `kenkeep-pack.yaml`.
- [x] Runnable verification: `find /tmp/kk-t1-pack/knowledge -name 'FOLDER_SUMMARIES.md'` prints nothing (the registry must not be inside `knowledge/`).
- [x] Runnable verification: the `summaries` map in `/tmp/kk-t1-pack/knowledge.FOLDER_SUMMARIES.md` contains the branch keys from `/workspace/.ai/kenkeep/FOLDER_SUMMARIES.md` (`harnesses`, `hooks`, `curation`, …) with their authored text byte-identical.
- [x] Runnable verification: `npx tsc --noEmit` exits `0`.
- [x] Clean up `/tmp/kk-t1-pack` when done.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Edit only `src/commands/pack-export.ts`.
- Reuse `writeFolderSummaries` and `readFolderSummaries` from `src/lib/folder-summaries.ts`. Do not parse or serialize frontmatter directly in the pack module, and do not add new exported helpers to `folder-summaries.ts`.
- Report warnings through the existing `log.warn` used by `reportLint` (`src/commands/pack-export.ts:193-200`).

## Input Dependencies

None. This task starts from the current `main` tree.

## Output Artifacts

- `src/commands/pack-export.ts` emitting `<packRoot>/knowledge.FOLDER_SUMMARIES.md`.
- The pack-side registry file that task 2 validates and task 3 consumes.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

**Why the filename works without new path code.** `folderSummariesFileForNodesDir(dir)` in `src/lib/folder-summaries.ts:18-21` returns a sibling `FOLDER_SUMMARIES.md` when `basename(dir) === 'nodes'`, and `<parent>/<basename>.FOLDER_SUMMARIES.md` otherwise. `pack export` stages the tree at `join(tmpOut, PACK_KNOWLEDGE_DIRNAME)`, i.e. `<tmpOut>/knowledge`, so calling `writeFolderSummaries(knowledgeOut, entries)` writes `<tmpOut>/knowledge.FOLDER_SUMMARIES.md` — exactly the pack-root file required. Do not compute this path by hand.

**Where to insert.** In `runPackExportCommand`, the sequence at `src/commands/pack-export.ts:62-68` is currently:

1. `const knowledgeOut = join(tmpOut, PACK_KNOWLEDGE_DIRNAME);`
2. `copyTree(paths.nodesDir, knowledgeOut);`
3. `writeManifest(tmpOut, resolved.manifest);`
4. `writeReadme(tmpOut, resolved.manifest);`
5. `const lint = runLint({ nodesDir: knowledgeOut });`

Insert the registry write between step 2 and step 5. The subsequent `renameSync(tmpOut, resolved.outDir)` at line 76 carries the file into the published directory automatically — do not add a second write after the rename.

**Computing the pruned entry set.**

1. Read the repo registry: `readFolderSummaries(paths.nodesDir)` returns a `Map<string, string>` keyed by POSIX-relative folder path, with the root folder as the empty-string key `''`.
2. Collect the folders that exist in the exported tree. Walk `knowledgeOut` recursively with `readdirSync(dir, { withFileTypes: true })`, collecting every directory as a POSIX path relative to `knowledgeOut`. Include the empty-string key `''` for the root of the exported tree.
3. Build the output map by keeping only entries whose key is in the collected folder set. This mirrors the pruning `harvestFolderSummaries` does in memory at `src/lib/index-gen.ts:478-481` — do not invent a different notion of "which folders count".
4. Call `writeFolderSummaries(knowledgeOut, prunedMap)`.

`writeFolderSummaries` normalizes keys, drops blank values, sorts by `localeCompare`, and writes atomically, so the output is deterministic. Do not sort or normalize yourself.

**Missing-summary warnings.** After computing the pruned set, take the collected folder set minus the keys present in the pruned map. For each such folder, emit `log.warn(...)` with a message naming the folder path relative to `knowledge/`. Emit these near the existing `reportLint(lint.errors, lint.findings)` call so warnings appear together. This must never change the exit code: an incomplete registry is a warning, never a blocker. Do not call `process.exit` and do not add an early `return 1` for this condition.

**Explicitly out of scope for this task.**

- Do not add a lint rule. `src/lib/lint.ts` must not be modified — a new rule would change `kenkeep lint` output for every existing user.
- Do not add `readFolderSummariesFile` / `writeFolderSummariesFile` primitives to `src/lib/folder-summaries.ts`. The existing `nodesDir`-based functions already resolve the pack path.
- Do not touch `src/lib/pack.ts` or `src/commands/pack-import.ts`; those are tasks 2 and 3.
- Do not write any tests here; task 4 owns the test surface.
- Do not change `NODE_SCHEMA_VERSION`, `PackManifestSchema`, or `FolderSummaryRegistrySchema`.

**Note on the existing export lint call.** `runLint({ nodesDir: knowledgeOut })` at line 67 runs after your write, and its `empty-summary` rule will now read the pack's own registry. That rule only flags entries that exist and are blank, and `writeFolderSummaries` drops blanks, so it will report zero — this is expected and is why the missing-summary warning above is emitted separately rather than relying on lint.

</details>
