---
id: 1
group: "index-catalog-rewrite"
dependencies: []
status: "pending"
created: 2026-05-12
skills:
  - typescript
---
# Rewrite generateIndex as non-evicting catalog with in-degree sort and tag block

## Objective

Replace the trim-to-fit model in `src/lib/index-gen.ts` with a non-evicting catalog renderer. Every valid node appears, sorted by graph in-degree within each section, with a new `## By topic` semantic-navigation block. Swap the `IndexFrontmatter` schema field `budget_tokens` for `estimated_tokens`. Delete every symbol tied to the old budget-trim model.

## Skills Required

- **typescript**: writing pure functions, refining a Zod schema, modifying a deterministic markdown renderer.

## Acceptance Criteria

- [ ] `generateIndex` no longer evicts any valid node; the `while (estimateTokens(body) > budget)` loop is removed.
- [ ] `trimOldest`, `MIN_PER_KIND`, `DEFAULT_BUDGET_TOKENS`, the `hiddenByBudget` field on `GeneratedIndex`, and the `budgetTokens` field on `GenerateOptions` are deleted from `src/lib/index-gen.ts`.
- [ ] `computeInDegree(nodes: NodeFile[]): Map<string, number>` is added as a pure function counting incoming `relates_to` and `depends_on` edges across all input nodes (valid + superseded).
- [ ] `renderBullet` emits `- **${title}** [\`${path}\`]${tags.map(t => ' #' + t).join('')}` (no em-dash, no parenthesized tag list, no summary).
- [ ] Section headings render as `## Conventions (how we build)` and `## Components (what exists)`. The `validByKind` map keys (`practice`, `map`) remain unchanged.
- [ ] Within each section, the comparator sorts by `inDegree[b.id] - inDegree[a.id]` first, then by `a.title.localeCompare(b.title)`.
- [ ] `renderTagIndex(validNodes, inDegree)` is added. It builds a `Map<tag, NodeFile[]>` from `frontmatter.tags`, sorts tag keys by bucket size DESC then alpha, sorts each bucket's titles by in-degree DESC then alpha, and emits one bullet per tag: `- **#${tag} (${count}):** ${titles.join(', ')}`. Section heading is `## By topic`.
- [ ] `## Recently superseded` keeps `sortByUpdatedDesc` and `RECENT_SUPERSEDED_LIMIT = 5`, with successor info retained but no summary clause.
- [ ] Body header line is `_${nodeCount} nodes • ${validCount} valid • ${supersededCount} superseded • ~${estimatedTokens} estimated tokens_`. `estimatedTokens` is computed via one `estimateTokens(body)` pass after sections are assembled.
- [ ] `generateIndex` returns `{ content, nodesHash, nodeCount, estimatedTokens }` — no `hiddenByBudget`.
- [ ] `IndexFrontmatterSchema` in `src/lib/schemas.ts` drops `budget_tokens` and gains `estimated_tokens: z.number().int().nonnegative()`.
- [ ] The stringified INDEX frontmatter includes `schema_version`, `nodes_hash`, `node_count`, and `estimated_tokens`.
- [ ] No deprecation alias, no shim, no retained back-compat code path.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `src/lib/index-gen.ts` — primary rewrite.
- File: `src/lib/schemas.ts` — `IndexFrontmatterSchema` field swap.
- Pure functions: `computeInDegree`, comparator helpers, `renderTagIndex`, `renderBullet`. No I/O changes.
- Determinism: every output must be a deterministic function of the input node set. Locale-stable tiebreakers via `localeCompare`.
- Sorting:
  - `Conventions` / `Components`: in-degree DESC, title ASC.
  - `By topic`: tag bucket size DESC, tag name ASC; titles within bucket by in-degree DESC, title ASC.
  - `Recently superseded`: `updated` DESC, top `RECENT_SUPERSEDED_LIMIT = 5`.
- Body order: header → `## Conventions` → `## Components` → `## By topic` → optional `## Recently superseded`.

## Input Dependencies

None.

## Output Artifacts

- Updated `src/lib/index-gen.ts` exporting the new `generateIndex`, `computeInDegree`, `renderTagIndex`, and revised `renderBullet`.
- Updated `IndexFrontmatterSchema` in `src/lib/schemas.ts`.
- New shape of the `GeneratedIndex` return type for downstream consumers.

## Implementation Notes

<details>
<summary>Step-by-step implementation guide</summary>

1. Open `src/lib/index-gen.ts`. Delete the constants `MIN_PER_KIND` and `DEFAULT_BUDGET_TOKENS`. Delete the `trimOldest` function. Delete the `hiddenByBudget` field from the `GeneratedIndex` type. Delete `budgetTokens` from the `GenerateOptions` type.
2. Add a pure helper:

   ```ts
   export function computeInDegree(nodes: NodeFile[]): Map<string, number> {
     const m = new Map<string, number>();
     for (const n of nodes) m.set(n.id, 0);
     for (const n of nodes) {
       const edges = [
         ...(n.frontmatter.relates_to ?? []),
         ...(n.frontmatter.depends_on ?? []),
       ];
       for (const targetId of edges) {
         m.set(targetId, (m.get(targetId) ?? 0) + 1);
       }
     }
     return m;
   }
   ```

   Count both `relates_to` and `depends_on` across the full input set (valid + superseded) so that node validity flips do not destabilize sort.
3. Rewrite `renderBullet(node: NodeFile): string` to:

   ```ts
   const tagPart = node.frontmatter.tags?.map(t => ` #${t}`).join('') ?? '';
   return `- **${node.frontmatter.title}** [\`${node.relativePath}\`]${tagPart}`;
   ```

   Use whatever the existing path field is called (likely `relativePath` or similar — match the existing code rather than introducing a new field name).
4. Rename the section labels. Where the code previously emitted `'## Practice (how we build)'` and `'## Map (what exists)'`, emit `'## Conventions (how we build)'` and `'## Components (what exists)'`. The internal `validByKind` map keys (`practice`, `map`) — which come from on-disk node `kind` values — do not change.
5. Replace the within-section sort with a comparator that uses the `inDegree` map computed in step 2:

   ```ts
   const cmp = (a: NodeFile, b: NodeFile) => {
     const d = (inDegree.get(b.id) ?? 0) - (inDegree.get(a.id) ?? 0);
     return d !== 0 ? d : a.frontmatter.title.localeCompare(b.frontmatter.title);
   };
   ```
6. Add `renderTagIndex(validNodes: NodeFile[], inDegree: Map<string, number>): string`:

   ```ts
   const buckets = new Map<string, NodeFile[]>();
   for (const n of validNodes) {
     for (const t of n.frontmatter.tags ?? []) {
       if (!buckets.has(t)) buckets.set(t, []);
       buckets.get(t)!.push(n);
     }
   }
   const tags = [...buckets.keys()].sort((a, b) => {
     const d = buckets.get(b)!.length - buckets.get(a)!.length;
     return d !== 0 ? d : a.localeCompare(b);
   });
   const lines = ['## By topic', ''];
   for (const tag of tags) {
     const titles = buckets.get(tag)!
       .slice()
       .sort((a, b) => {
         const d = (inDegree.get(b.id) ?? 0) - (inDegree.get(a.id) ?? 0);
         return d !== 0 ? d : a.frontmatter.title.localeCompare(b.frontmatter.title);
       })
       .map(n => n.frontmatter.title);
     lines.push(`- **#${tag} (${titles.length}):** ${titles.join(', ')}`);
   }
   return lines.join('\n');
   ```

   If `validNodes` has zero tags overall, you may either emit the heading alone or skip the section entirely — match whichever pattern the existing code uses for "empty section". When in doubt, emit the heading; downstream consumers treat INDEX as opaque markdown.
7. Rewrite `generateIndex` orchestration:
   1. Read nodes, partition into `valid` / `superseded` exactly as before.
   2. Call `computeInDegree(allNodes)`.
   3. Group `valid` by kind, sort each group with the new comparator.
   4. Render `## Conventions (how we build)` from `practice` group, `## Components (what exists)` from `map` group.
   5. Render `## By topic` from valid nodes.
   6. Render `## Recently superseded` from sorted superseded (keep `RECENT_SUPERSEDED_LIMIT`).
   7. Assemble body in order: header placeholder, sections, `## By topic`, `## Recently superseded` (when non-empty).
   8. Compute `estimatedTokens = estimateTokens(body)` once.
   9. Substitute the header line: `_${nodeCount} nodes • ${validCount} valid • ${supersededCount} superseded • ~${estimatedTokens} estimated tokens_`.
   10. Compute `nodesHash` as before (`computeNodesHash`).
   11. Stringify frontmatter with `schema_version`, `nodes_hash`, `node_count`, `estimated_tokens`. Drop `budget_tokens`.
   12. Return `{ content, nodesHash, nodeCount, estimatedTokens }`.
8. Open `src/lib/schemas.ts`. Find `IndexFrontmatterSchema`. Remove `budget_tokens`. Add `estimated_tokens: z.number().int().nonnegative()`.
9. Run `npm run typecheck` locally to catch every orphaned reference that this task should not touch (those belong to follow-up tasks). Note them but do not edit those files in this task.
10. Do not delete `bootstrapTokenBudget` — that's a different concept used in doc-chunking during bootstrap.

</details>

<details>
<summary>Files and symbols affected by this task</summary>

- `src/lib/index-gen.ts`: rewrite generator; delete `trimOldest`, `MIN_PER_KIND`, `DEFAULT_BUDGET_TOKENS`, `hiddenByBudget`, `budgetTokens`; add `computeInDegree`, `renderTagIndex`.
- `src/lib/schemas.ts`: `IndexFrontmatterSchema` swap `budget_tokens` → `estimated_tokens`.

</details>

<details>
<summary>Out of scope for this task</summary>

- Settings schema (`SettingsSchema.indexBudgetTokens`), settings loader, CLI flag, command files, tests, docs. Those are handled by tasks 2–4.
- Per-tag title truncation policy (out of scope for the whole plan; the bullet shape leaves room for it later).

</details>
