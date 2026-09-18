---
id: 1
group: "loose-leaf-placement"
dependencies: []
status: "completed"
created: 2026-09-18
skills:
  - typescript
  - vitest
complexity_score: 5
execution_profile: "complex-architecture"
---
# Pure leaf placement function

## Objective

Add one pure module under `src/lib/` that turns a leaf's own frontmatter plus the live tree into
either a destination folder or an explicit unplaceable result. Edges decide first, tag overlap
breaks the tie, alphabetical folder path breaks the remaining tie. No clock, no randomness, no
LLM, no filesystem writes.

## Skills Required

TypeScript for the module itself, Vitest for the table of resolution cases. Both are already in
the toolchain; no new dependency.

## Acceptance Criteria

- [ ] `src/lib/leaf-placement.ts` exports a placement function and a discriminated result type
      covering `placed`, `unplaceable`, and `no-folders`.
- [ ] Given the three root leaves in `.ai/kenkeep/nodes/`, the function resolves
      `practice-copilot-file-based-sessionstart-must-use-shared-context-builder` to `harnesses`,
      `practice-distinguish-kenkeep-development-tooling-from-the-kenkeep-product` to `conventions`,
      and `practice-keep-template-partials-out-of-the-knowledge-base` to `config-and-prompts`.
- [ ] Calling the function twice on a tied input returns deeply equal results.
- [ ] A tree with zero folders returns the `no-folders` result, never `unplaceable`.
- [ ] `npx vitest run tests/lib/leaf-placement.test.ts` exits 0 and reports every case below as
      passing: edge-count winner, tag-overlap tie-break, alphabetical tie-break, no-edges leaf
      placed by whole-tree tag overlap, no-edges-no-overlap leaf reported unplaceable, empty-folder
      tree reported as `no-folders`, and two root leaves that edge only to each other both placed
      by tag overlap.
- [ ] `npm run typecheck` and `npm run lint` exit 0.

## Technical Requirements

Input is a `NodeFile` (or its frontmatter) plus the leaf set of the live tree, both from
`src/lib/nodes.ts`. Reuse `readAllNodes`/`generateIndex` output rather than walking the tree
inside the module, so the function stays pure and the callers own the read.

Resolution order, stopping at the first single winner:

1. Tally every `kk_relates_to` and `kk_depends_on` target by the folder its node currently
   occupies. Targets that dangle or that sit at the root contribute nothing. Highest tally wins.
   The two edge kinds carry equal weight.
2. On a tie, score each tied folder by how many of the leaf's tags appear across that folder's
   direct leaves, summing occurrences rather than counting distinct tags. Highest score wins.
3. On a further tie, take the first candidate by `localeCompare` on the POSIX folder path.
4. When step 1 produces no candidate at all, score every folder in the tree by the same tag
   overlap and take the highest, alphabetical on a tie.
5. Zero overlap against every folder in a tree that has folders means unplaceable.

Live folder membership of the three fixture leaves, for the assertions:
`map-copilot-harness-adapter` and `practice-harness-dirs-are-vendored-or-dogfooded-not-source` are
in `harnesses/` and `conventions/` respectively; `map-session-start-hook` and
`practice-shipped-skills-and-hook-scripts-must-be-self-contained` are in `hooks/`;
`practice-bump-prompt-version-comment` is in `config-and-prompts/`. Confirm each against the tree
before asserting, because the tree moves.

## Input Dependencies

None. This is the first task.

## Output Artifacts

`src/lib/leaf-placement.ts` and `tests/lib/leaf-placement.test.ts`. Tasks 2 and 3 both import the
exported function and result type.

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

Create `src/lib/leaf-placement.ts`. Do not put this in `src/lib/rebalance.ts`: it is called by
curation and by a standalone command and has nothing to do with structural rebalancing.

Suggested shape:

```ts
export type PlacementResult =
  | { kind: 'placed'; folder: string; reason: 'edges' | 'tags' | 'alphabetical' }
  | { kind: 'unplaceable' }
  | { kind: 'no-folders' };

export interface PlacementInput {
  tags: string[];
  kk_relates_to: string[];
  kk_depends_on?: string[] | undefined;
}

export function placeLeaf(leaf: PlacementInput, tree: NodeFile[], selfId?: string): PlacementResult;
```

Derive the folder set from `tree` as the distinct non-empty `relDir` values. When that set is
empty, return `{ kind: 'no-folders' }` before anything else. This guard is what keeps a fresh or
bootstrap-era tree away from the delete rule in Task 3.

Build an id-to-relDir map once from `tree`. For step 1, walk
`[...leaf.kk_relates_to, ...(leaf.kk_depends_on ?? [])]`, look each id up, and skip the entry when
the id is missing from the map or maps to `''`. Tally into a `Map<string, number>`. Take the max
count, then collect every folder holding that count. One folder means an edge winner; two or more
means a tie and step 2 runs over exactly those tied folders.

For tag overlap, count occurrences rather than distinct tags: for a candidate folder, iterate its
direct leaves (`relDir === folder`, excluding the leaf being placed via `selfId`) and for each
leaf add the number of its tags that appear in the placed leaf's tag set. Summing occurrences is
deliberate. It is what resolves the copilot leaf to `harnesses/` (19) over `hooks/` (14).

Direct leaves only. A leaf in `a/b` is not a direct leaf of `a`.

Sort candidates with `localeCompare` on the POSIX path for the final tie-break. It must be
arbitrary, because on a tie the evidence has run out, and it must not be random, because the
function has to return byte-identical output for identical input.

Add a doc comment stating that ranking folder summaries is the curator's job and was already
attempted for any leaf that reaches this function. Someone will otherwise try to add it.

For the test file, copy the `writeLeaf` fixture helper pattern from
`tests/commands/rebalance.test.ts` (gray-matter `matter.stringify` with `kk_schema_version: 3`,
`kk_id`, `title`, `type`, `description`, `tags`, `kk_derived_from`, `kk_relates_to`,
`kk_confidence`). Build the trees in a sandbox from `tests/helpers.ts` and read them with
`readAllNodes`, or construct `NodeFile` values directly if that is cleaner. For the three-fixture
assertion, read the real tree at `.ai/kenkeep/nodes` from `repoRoot` so the test proves the plan's
first success criterion against live data rather than a hand-built copy.

The mutually-edged pair case: two leaves at the root whose only edges point at each other. Neither
resolves a folder in step 1, both fall through to whole-tree tag overlap, and both must be placed.
Root-resident targets contribute no folder by design.

Cover a target that has itself moved: place the target in a different folder than the test's first
arrangement and assert the placement follows it. Ids are identity; paths are current state.

</details>
