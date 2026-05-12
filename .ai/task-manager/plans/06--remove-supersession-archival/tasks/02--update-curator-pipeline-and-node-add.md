---
id: 2
group: "runtime"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Drop removed-field plumbing from curator pipeline and node-add

## Objective

Update `src/lib/curate.ts` and `src/commands/node-add.ts` so neither reads, generates, stamps, nor writes any of the removed frontmatter fields. The curator's `modify`, `add`, and `contradict` persistence paths emit `NodeFrontmatter` and `CuratorProposedNode` objects matching the slimmer schemas from task 1. `node add` no longer fills `valid_from`, `valid_until`, `updated`, `supersedes`, or `superseded_by`.

## Skills Required

- typescript: refactor pipeline functions, remove now-unused parameters/locals, and ensure types compile against the slimmer schemas.

## Acceptance Criteria

- [ ] `buildNodeFrontmatter()` in `src/lib/curate.ts` reads and writes only fields that exist in the new `NodeFrontmatterSchema`. No reference to `valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`.
- [ ] `persistAction()` for `add` and `modify` writes a frontmatter object containing only surviving fields. `modify` does not stamp any timestamp.
- [ ] `persistAction()` for `contradict` still emits a `ConflictReport`; its embedded `proposed_node` uses the trimmed `CuratorProposedNode` shape.
- [ ] `src/commands/node-add.ts` produces a node file whose frontmatter parses cleanly against the new `NodeFrontmatterSchema`, with none of the removed fields written.
- [ ] No code path constructs a "default" or "null" value for any removed field. The fields simply do not appear.
- [ ] Any local helper, constant, or comment that existed only to compute one of the removed fields is deleted, not commented out.
- [ ] `npm run typecheck` is green for `src/lib/curate.ts` and `src/commands/node-add.ts`.
- [ ] No retrospective framing in remaining comments.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files:
  - `src/lib/curate.ts` (focus on `buildNodeFrontmatter`, `persistAction`, and any conflict-writing helper around lines 480-500).
  - `src/commands/node-add.ts` (frontmatter assembly path).
- Behavior change for `modify`: where the function previously stamped `updated: now.toISOString()`, it now writes the frontmatter with no timestamp. Git history is the timeline of record.
- The function that writes `pending-conflicts.json` may continue to record a wall-clock `recorded_at` if the surrounding `PendingConflictsFileSchema` requires it; this task only removes the per-node temporal fields.

## Input Dependencies

- Task 1 completed (schemas slimmed) so the types this code returns are valid.

## Output Artifacts

- Modified `src/lib/curate.ts` and `src/commands/node-add.ts` that build only the new shape.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Open `src/lib/curate.ts`. Search the file for `valid_from`, `valid_until`, `updated`, `supersedes`, `superseded_by`. Around lines 480-500 the persistence path stamps these. Delete those lines.

2. Inspect the `buildNodeFrontmatter` helper (if present). Remove any parameter, local, or branch that only feeds the removed fields. If the helper signature shrinks, update its call sites.

3. Inspect `persistAction`. The `modify` branch will lose the `updated` stamp. The `add` branch will lose `valid_from`/`valid_until`. The `contradict` branch should pass the `proposed_node` straight through from the curator output (now slimmer thanks to task 1) without re-stamping.

4. Check if any imported helper from `date-fns`, the standard `Date` constructor, or a custom clock utility is now unused. Remove unused imports.

5. Open `src/commands/node-add.ts`. Locate the frontmatter assembly object. Remove the keys that no longer exist in the schema. If the command used a "now" timestamp only for those fields, remove that computation entirely.

6. Run `npm run typecheck`. Errors should now be confined to: tests, generators (task 3), prompts (task 4), node files (task 5), and docs (task 7). If errors remain inside `curate.ts` or `node-add.ts`, fix them.

7. Run `grep -n "valid_from\|valid_until\|supersedes\|superseded_by\|updated:" src/lib/curate.ts src/commands/node-add.ts`; expect no hits.

8. Do not add comments narrating the removal. The code now reflects the current design only.

</details>
