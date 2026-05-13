---
id: 5
group: "nodes"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Bound ensureUniqueId to 4 collisions, throw on overflow

## Objective
Replace the 98-suffix + SHA-256 discriminator fallback in `ensureUniqueId` with a small bounded loop (suffixes -2 through -4) that throws a clear error after 4 collisions. The `createHash` import is removed if `nodes.ts` no longer needs it.

## Skills Required
- typescript: edit `src/lib/nodes.ts` and its test

## Acceptance Criteria
- [x] `ensureUniqueId` in `src/lib/nodes.ts` returns `candidate` if unique, then tries `${candidate}-2`, `${candidate}-3`, `${candidate}-4`; if all four are taken, throws `Error("id \"${candidate}\" collides with 4 existing ids; choose a more distinct title")`.
- [x] The SHA-256 hash discriminator branch (`${candidate}-${sha256.slice(0,6)}`) and the 98-suffix loop are deleted.
- [x] `createHash` import is removed from `src/lib/nodes.ts` if no other call site in the file needs it; left alone otherwise.
- [x] A test covers: returns base id when unique; returns `-2`/`-3`/`-4` on collisions; throws after 4 collisions with the documented message.
- [x] `npm run lint`, `npm run typecheck`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript edit confined to `src/lib/nodes.ts` and one test file.

## Input Dependencies
None.

## Output Artifacts
- Edited `src/lib/nodes.ts`.
- Updated test for `ensureUniqueId`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Open `src/lib/nodes.ts:176` (per plan). Replace the body of `ensureUniqueId`:
   ```ts
   export function ensureUniqueId(existingIds: Set<string>, candidate: string): string {
     if (!existingIds.has(candidate)) return candidate;
     for (let i = 2; i <= 4; i += 1) {
       const next = `${candidate}-${i}`;
       if (!existingIds.has(next)) return next;
     }
     throw new Error(`id "${candidate}" collides with 4 existing ids; choose a more distinct title`);
   }
   ```
2. Check for remaining uses of `createHash` in this file. If none, delete the `import { createHash } from 'node:crypto'` line.
3. Update the test for `ensureUniqueId` (locate via grep). Replace any assertion that expected a `-<hash6>` suffix with the throw expectation. Add cases for `-2`, `-3`, `-4`.
4. Run `npm run lint`, `npm run typecheck`, `npm test`.

</details>
