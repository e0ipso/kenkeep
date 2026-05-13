---
id: 3
group: "capture"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Delete the disk-persisted dedup cache

## Objective
Remove `src/lib/dedup-cache.ts` and `DedupCacheFileSchema`. The capture path relies on the existing session-id overwrite (`findSessionLogBySessionId`) only. Each `Stop` fire re-runs the secret scan and re-renders the session log.

## Skills Required
- typescript: edit `src/lib/capture.ts`, `src/lib/schemas.ts`, delete `src/lib/dedup-cache.ts`, update tests

## Acceptance Criteria
- [x] `src/lib/dedup-cache.ts` is deleted.
- [x] `DedupCacheFileSchema` and its inferred type are removed from `src/lib/schemas.ts`.
- [x] `isDuplicate`, `recordHash`, the `dedupCacheFile` variable, and the `hash` variable used to feed them are removed from `captureSession` in `src/lib/capture.ts`. The corresponding import is removed.
- [x] The `'duplicate'` literal is removed from the `CaptureStatus` union; any `switch` arm or comparison against `'duplicate'` is deleted from callers (search `src/`, `bin/`, `.claude/skills/`, `scripts/`).
- [x] Test fixtures and tests referencing `.dedup-cache.json` or asserting "second fire returns duplicate" are deleted; remaining tests for `captureSession` still pass.
- [x] No source file imports from `./dedup-cache` or references `DedupCacheFileSchema`.
- [x] `npm run lint`, `npm run typecheck`, and `npm test` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript edits across capture path.
- Note: This task does not yet touch the queue calls in `capture.ts` (lines 118-127 per plan) — that is done in task 4.

## Input Dependencies
None.

## Output Artifacts
- Deleted file: `src/lib/dedup-cache.ts`.
- Edits to `src/lib/capture.ts` and `src/lib/schemas.ts`.
- Updated tests.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Grep for callers before deleting: `rg -n "dedup-cache|DedupCacheFileSchema|isDuplicate|recordHash" src/ test/ bin/ scripts/ .claude/`.
2. In `src/lib/capture.ts`:
   - Remove the `import` for `isDuplicate`, `recordHash`, and any related symbols from `./dedup-cache`.
   - In `captureSession`, delete the block that builds the `hash`, calls `isDuplicate`, returns the `'duplicate'` result, and calls `recordHash`. The remaining flow proceeds straight to secret scan + render.
   - Keep `findSessionLogBySessionId` use intact; the overwrite is what bounds the file count.
3. In `src/lib/schemas.ts`, remove `DedupCacheFileSchema` and the exported type `DedupCacheFile` (if present).
4. Delete `src/lib/dedup-cache.ts`.
5. Update `CaptureStatus` (likely in `src/lib/capture.ts` or `schemas.ts`): remove `'duplicate'` from the union.
6. Update any caller doing `if (result.status === 'duplicate')` etc. Remove the dead arm.
7. Delete tests that assert the duplicate path (e.g. "Stop fires twice -> second returns duplicate"). Keep or adapt tests that assert "Stop fires twice -> single file on disk" (this still holds, via overwrite).
8. Delete fixtures referencing `.dedup-cache.json`.
9. Run `npm run lint`, `npm run typecheck`, `npm test`.

</details>
