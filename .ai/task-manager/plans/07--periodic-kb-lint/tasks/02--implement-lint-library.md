---
id: 2
group: "lint"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - typescript
---
# Implement the four-check lint library

## Objective

Create `src/lib/lint.ts` exporting a single function `runLint({ nodesDir })` that performs all four mechanical checks (dangling structured edges, slug/id naming, tag near-duplicates, orphan nodes) and returns a structured `LintResult` with `errors` (exit-1 conditions) and `findings` (exit-0 conditions). Each entry names the offending file, the rule that fired, and a one-line prescribed action.

## Skills Required

- typescript: filesystem walking via `readAllNodes`, frontmatter inspection, string normalization, set/map aggregation, zod-free TS-only types.

## Acceptance Criteria

- [ ] New file `src/lib/lint.ts` exports a `runLint(opts: { nodesDir: string }): LintResult` function.
- [ ] `LintResult` type is exported and shaped: `{ errors: LintEntry[]; findings: LintEntry[] }`. `LintEntry` carries `{ rule: 'dangling-edge' | 'slug-id-mismatch' | 'tag-near-duplicate' | 'orphan'; file: string; message: string; action: string }`. Tag-near-duplicate entries may set `file: ''` since they span multiple nodes (the message names the cluster and member counts).
- [ ] Check 1 (dangling structured edges): iterates each node, collects IDs referenced in `relates_to` and `depends_on`, and reports each ID that does not match any loaded node's `frontmatter.id` as a `dangling-edge` error.
- [ ] Check 2 (slug/id naming): for every node, asserts `frontmatter.id === \`${kind}-${slugify(<title-or-id-base>)}\`` AND `filename === \`${frontmatter.id}.md\`` AND the file lives under `nodes/<kind>/`. Each violation is a `slug-id-mismatch` error.
- [ ] Check 3 (tag near-duplicates): collects all tags across all nodes, normalizes via `(tag: string) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/s$/, '')`, groups by normalized form, reports each cluster of size ≥ 2 as a `tag-near-duplicate` finding. Each finding's `message` names the cluster members and the count of nodes affected; `action` recommends choosing a canonical tag and normalizing affected nodes.
- [ ] Check 4 (orphans): a node is orphan when (a) no other node references its `id` in `relates_to` or `depends_on`, AND (b) its own `relates_to` AND `depends_on` are both empty arrays. Reported as `orphan` findings. The action recommends adding cross-links or accepting that the node legitimately stands alone.
- [ ] The function returns deterministically: `errors` and `findings` are each sorted by `(rule, file, message)` lexicographically so test snapshots are stable.
- [ ] Uses existing helpers: `readAllNodes` from `src/lib/nodes.ts`, `slugify` from `src/lib/nodes.ts`. No new runtime dependencies.
- [ ] No I/O beyond `readAllNodes`. No console output. No state writes.
- [ ] `npm run typecheck` is clean.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- The schema fields available on each node are: `id`, `title`, `kind`, `tags`, `derived_from`, `relates_to`, `depends_on`, `confidence`, `summary`. There is NO `supersedes` / `superseded_by` on the current schema (removed in plan 06). The plan text for check 1 and check 4 also mentions those two fields, but they are intentionally NOT lintable here because the data model no longer carries them. The lint walks the fields that actually exist: `relates_to` and `depends_on`. Do not add a code comment about this; the README task documents the four checks as they ship.
- `derived_from` is intentionally excluded from the dangling-edge check (it points at source docs, not other nodes; doctor already covers it).
- The `nodes/<kind>/` directory layout is enforced by `readAllNodes`, which only walks `nodes/practice` and `nodes/map`. Use `node.path` to derive the kind segment for the slug/id check.
- `node.filename` is just the basename (e.g., `practice-foo.md`).

## Input Dependencies

None. (Settings consumption lives in the hook layer, not in the lint library; the library is a pure function over a nodes dir.)

## Output Artifacts

- `src/lib/lint.ts` exporting `runLint`, `LintResult`, `LintEntry`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Create `src/lib/lint.ts`. Import:

   ```ts
   import { dirname } from 'node:path';
   import { readAllNodes, slugify, type NodeFile } from './nodes.js';
   ```

2. Define the public types:

   ```ts
   export type LintRule = 'dangling-edge' | 'slug-id-mismatch' | 'tag-near-duplicate' | 'orphan';
   export interface LintEntry {
     rule: LintRule;
     file: string;
     message: string;
     action: string;
   }
   export interface LintResult {
     errors: LintEntry[];
     findings: LintEntry[];
   }
   export interface LintOptions { nodesDir: string; }
   ```

3. Export `runLint(opts: LintOptions): LintResult`. Inside:
   - Call `readAllNodes(opts.nodesDir)`. If it throws `InvalidNodeFrontmatterError`, let it propagate; the CLI layer formats it.
   - Build `idSet = new Set(nodes.map(n => n.frontmatter.id))` for O(1) lookup.
   - Build `incomingRefs = new Map<string, number>()` keyed by referenced ID, counting `relates_to` + `depends_on` mentions across the corpus.

4. **Check 1 (dangling edges)**: iterate each node; for each `ref` in `node.frontmatter.relates_to.concat(node.frontmatter.depends_on)`, if `!idSet.has(ref)` push `{ rule: 'dangling-edge', file: node.path, message: \`references unknown node \${ref}\`, action: 'Remove the broken reference from the frontmatter or create the missing node.' }` into `errors`.

5. **Check 2 (slug/id naming)**: for each node:
   - Compute `expectedId = \`${kind}-${slugify(node.frontmatter.id.replace(\`${kind}-\`, ''))}\`` if the id starts with the kind prefix, otherwise treat as mismatch. More precisely: the canonical id is `<kind>-<slug-of-the-bare-segment>`. If the bare segment differs from its slugified form, that is a mismatch. Use `slugify` to compute the canonical bare segment from `node.frontmatter.id.slice(kind.length + 1)`.
   - Confirm `node.filename === \`${node.frontmatter.id}.md\``.
   - Confirm `dirname(node.path).endsWith(\`nodes/${kind}\`)` (use posix-friendly compare via `node.path.split(/[\\/]/).slice(-2, -1)[0] === kind`).
   - Any failure pushes a single `slug-id-mismatch` error per node naming the specific failure mode in `message`; `action: 'Rename the file and fix the id so id == <kind>-<slug> and filename == <id>.md under nodes/<kind>/.'`.

6. **Check 3 (tag near-duplicates)**:
   - `normalize(tag) = tag.toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/s$/, '')`.
   - Build `Map<string, { original: Set<string>; nodes: Set<string> }>` keyed by normalized form. For each tag on each node, add the original tag to `original` and the node id to `nodes`.
   - For each entry whose `original.size >= 2`, push one `tag-near-duplicate` finding with `file: ''`, `message: \`tag cluster {${[...original].sort().join(', ')}} affects ${nodes.size} node(s)\``, `action: 'Pick a canonical tag and normalize the affected nodes.'`.

7. **Check 4 (orphans)**:
   - For each node, count outgoing edges = `relates_to.length + depends_on.length`.
   - Count incoming edges = number of OTHER nodes whose `relates_to` ∪ `depends_on` contains this node's id. (Pre-build the incoming-ref index in step 3 to keep this O(N).)
   - If both counts are zero, push `{ rule: 'orphan', file: node.path, message: \`orphan node \${node.frontmatter.id}\`, action: 'Add cross-links to neighboring nodes, or accept that this node legitimately stands alone.' }` into `findings`.

8. Sort `errors` and `findings` by `(rule, file, message)` before returning. Stable sort is fine.

9. Do not import anything from `commander`, do not write to disk, do not throw outside of the `readAllNodes` propagation.

10. End-of-file newline; no trailing spaces.

</details>
