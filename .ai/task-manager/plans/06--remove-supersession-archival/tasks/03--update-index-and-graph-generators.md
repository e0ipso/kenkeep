---
id: 3
group: "runtime"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Remove partition, status line, and "Recently superseded" block from index-gen

## Objective

Rewrite `src/lib/index-gen.ts` so INDEX.md and GRAPH.md are generated from a single, uniform set of current nodes. Drop `RECENT_SUPERSEDED_LIMIT`, `partition()`, `isValid()`, `sortByUpdatedDesc()`, the `recentSuperseded` parameter and rendering branch in `renderBody()`, and the per-node `status:`, `supersedes:`, `superseded_by:` lines in GRAPH.md. INDEX header becomes `_${nodeCount} nodes • ~${estimatedTokens} estimated tokens_`. Functions remain deterministic and pure.

## Skills Required

- typescript: refactor a generator module while preserving determinism and output formatting.

## Acceptance Criteria

- [ ] `src/lib/index-gen.ts` exports no `RECENT_SUPERSEDED_LIMIT`. The constant is deleted.
- [ ] Functions `partition`, `isValid`, `sortByUpdatedDesc` are deleted (not commented).
- [ ] `generateIndex` accepts the same node array but no longer splits it. Tokens are estimated over the full set.
- [ ] The rendered INDEX header line reads `_N nodes • ~T estimated tokens_` (no `V valid`, no `S superseded`).
- [ ] The rendered INDEX body contains no `## Recently superseded` heading.
- [ ] `generateGraph` per-node block contains no `- **status:** …` line and no `- **supersedes:** …` / `- **superseded_by:** …` lines.
- [ ] `computeInDegree` continues to operate on the full input set and is unchanged in behavior.
- [ ] All callers of `generateIndex` / `generateGraph` compile against the trimmed signatures (no `recentSuperseded` parameter, no `validCount`/`supersededCount` return).
- [ ] `npm run typecheck` passes for `src/lib/index-gen.ts` and its callers.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- File: `src/lib/index-gen.ts`.
- Other callers to inspect: `src/commands/index-rebuild.ts` (or whichever command invokes `generateIndex`/`generateGraph`), and any test that imports these functions.
- The INDEX header line is exact; reproduce the surrounding spacing and trailing newlines used by the existing implementation.

## Input Dependencies

- Task 1 completed (slimmer `NodeFrontmatter` removes the `valid_until`/`superseded_by` fields the deleted helpers read).

## Output Artifacts

- Modified `src/lib/index-gen.ts`.
- Updated call sites in `src/commands/index-rebuild.ts` (and any other consumer) reflecting the new signatures.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Open `src/lib/index-gen.ts`. Confirm the anchors:
   - Line 6: `export const RECENT_SUPERSEDED_LIMIT = 5;` — delete.
   - Around line 20-30: `isValid`, `partition` — delete.
   - Around line 34: `sortByUpdatedDesc` — delete.
   - Around line 127-135: the `partition()` call and the superseded sort — delete.
   - Around line 147: `recentSuperseded` slice — delete.
   - Around line 182: the `## Recently superseded` block — delete the entire `parts.push(...)` block that renders it.
   - Around line 213: `lines.push(\`- **status:** ${status}\`)` — delete; also remove the surrounding `status` computation and any `supersedes` / `superseded_by` line pushes that follow it.

2. Update `generateIndex` to compute `nodeCount = nodes.length` and `estimatedTokens` over the full input. The header template becomes:
   ```
   `_${nodeCount} nodes • ~${estimatedTokens} estimated tokens_`
   ```
   Note: the bullet between the two counts is U+2022 (`•`), matching the prior header style. Verify by inspection of the existing string.

3. If `renderBody` (or whatever the body renderer is called) had a `recentSuperseded` parameter, drop it from the signature and every call site.

4. Find callers: `grep -rn "generateIndex\|generateGraph" src tests`. Update each call site to match the new signatures. If a command reported separate "valid" and "superseded" counts to stdout, simplify it to a single count.

5. Run `npm run typecheck`. Errors that remain should be in tests (task 6), docs (task 7), prompts (task 4), or node files (task 5), not in `index-gen.ts` or its direct callers.

6. Quick functional sanity: in a scratch repl, call `generateIndex` with an empty node array and confirm the header reads `_0 nodes • ~0 estimated tokens_`.

7. Do not add comments explaining the removal. Code reflects the current design.

</details>
