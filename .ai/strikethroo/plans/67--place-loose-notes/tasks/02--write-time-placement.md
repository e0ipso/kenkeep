---
id: 2
group: "loose-leaf-placement"
dependencies: [1]
status: "completed"
created: 2026-09-18
skills:
  - typescript
  - vitest
complexity_score: 4
execution_profile: "standard-implementation"
---
# Derive the home folder at write time in curate-persist

## Objective

Stop `curate-persist` from stranding a leaf at the `nodes/` root when the curator left
`home_folder` empty. Call the placement function from Task 1 instead, and report a derived folder
distinguishably from one the curator chose. Write time never deletes.

## Skills Required

TypeScript for the change in `src/commands/curate-persist.ts`, Vitest for the two persistence
cases.

## Acceptance Criteria

- [ ] An `add` action with an empty, null, or absent `home_folder` is written into the folder the
      placement function derives, not at the root.
- [ ] The per-action result distinguishes a derived placement from a curator-chosen one. A
      curator-chosen folder still reports that folder; a derived one is marked as derived in the
      JSON summary.
- [ ] An `add` whose placement comes back unplaceable is still written at the `nodes/` root and
      reports `root fallback`. No file is deleted on any path through this command.
- [ ] A tree with no folders writes at the root, same as today.
- [ ] A non-empty `home_folder` that does not exist under `nodes/` still fails the action with the
      existing message. The placement function does not rescue a bad explicit folder.
- [ ] `modify` behaviour is unchanged: in place at the target's current path, reported as
      `in place`.
- [ ] `npx vitest run tests/commands/curate-persist.test.ts` exits 0, including new cases for the
      derived-placement path and the unplaceable-stays-at-root path.
- [ ] `npm run typecheck` and `npm run lint` exit 0.

## Technical Requirements

The edges and tags the placement function needs are already on `action.proposed_node`
(`kk_relates_to`, `kk_depends_on`, `tags`), so no new input plumbing is required.

`readAllNodes(paths.nodesDir)` is already called once near the top of
`runCuratePersistCommand` and its result is held in `existingNodes`. Reuse that snapshot for the
placement call rather than re-reading per action.

The `placement` field on `PersistResult` is the reporting channel. Its current values are
`in place`, `root fallback`, and the folder path. Add a distinct form for a derived folder, for
example `derived: <folder>`, and keep the existing three values intact so Step 7 of the kk-curate
skill can still read them. Task 4 documents whatever shape you land on.

## Input Dependencies

Task 1: the exported placement function and result type from `src/lib/leaf-placement.ts`.

## Output Artifacts

Updated `src/commands/curate-persist.ts` and `tests/commands/curate-persist.test.ts`. Task 4
documents the reporting change in the kk-curate skill template.

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

In `src/commands/curate-persist.ts`, the `add` branch currently reads:

```ts
const home = (action.home_folder ?? '').trim();
if (!isExistingFolder(paths.nodesDir, home)) {
  results.push(failure(action, index, `home_folder "${home}" does not exist under nodes/`));
  continue;
}
const id = ensureUniqueId(existingIds, deriveNodeId(node.type, node.title));
relDir = home;
```

Keep the existing-folder check for a non-empty `home`, because an explicit folder that does not
exist is still a curator error and must still fail. Only the empty case changes. Roughly:

```ts
const home = (action.home_folder ?? '').trim();
let derived = false;
let relDirForAdd = home;
if (home === '') {
  const placement = placeLeaf(
    { tags: node.tags, kk_relates_to: node.kk_relates_to, kk_depends_on: node.kk_depends_on },
    existingNodes
  );
  if (placement.kind === 'placed') {
    relDirForAdd = placement.folder;
    derived = true;
  }
} else if (!isExistingFolder(paths.nodesDir, home)) {
  results.push(failure(action, index, `home_folder "${home}" does not exist under nodes/`));
  continue;
}
```

`no-folders` and `unplaceable` both leave `relDirForAdd` as `''`, which is today's behaviour, so
they need no branch of their own. Write it so that reads clearly, and say so in a comment: a
curator can legitimately propose a genuinely novel note whose topic has no neighbours yet, and
silently discarding it would lose knowledge with no diff to review. All deletion lives in the
sweep from Task 3, where the human sees it.

The placement function returns a folder that exists in the tree by construction, since it is
derived from folders holding real leaves. A defensive `isExistingFolder` call on the derived path
is still cheap and is worth keeping.

At the result push, the `placement` field currently reads:

```ts
placement: action.action === 'modify' ? 'in place' : relDir === '' ? 'root fallback' : relDir,
```

Extend it so a derived folder is distinguishable. Keep the ternary readable; if it grows past two
levels, lift it into a small named helper.

Note that `existingNodes` is a snapshot taken before the loop. Within one run, a leaf written by an
earlier action is not in it. That is acceptable here and matches the existing `existingIds`
handling for collisions only. Do not re-read the tree per action on the curate hot path.

For the tests, `tests/commands/curate-persist.test.ts` already builds sandboxes and pipes curator
output JSON to the built CLI. Add two cases:

1. A tree with a `harnesses/` folder holding two tagged leaves, plus an `add` with empty
   `home_folder` whose `kk_relates_to` names one of them. Assert the written path is under
   `harnesses/` and the summary marks the placement as derived.
2. A tree with one folder whose leaves share no tags with the candidate, plus an `add` with empty
   `home_folder` and no edges. Assert the file lands at the `nodes/` root, the placement reads
   `root fallback`, and no pre-existing file was removed.

Run `npm run build` before the tests; `pretest` does this, but a bare `vitest run` against
`dist/cli.js` will otherwise use a stale bundle.

</details>
