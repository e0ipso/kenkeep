---
id: 2
group: "dedup-helpers"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills: ["typescript"]
---
# Extract shared fs-atomic helpers (atomicWriteJson + readJsonValidated)

## Objective
Replace the five+ duplicate `writeFileSync(tmp); renameSync(tmp, file)` JSON-write blocks and the scattered `JSON.parse + Zod safeParse + fallback` reader blocks with shared helpers in `src/lib/fs-atomic.ts`.

## Skills Required
- `typescript`: extract helpers, migrate consumers, preserve current semantics for warning emission.

## Acceptance Criteria
- [ ] `src/lib/fs-atomic.ts` exists and exports:
  - `export function atomicWriteJson(file: string, data: unknown): void` — formats with `JSON.stringify(data, null, 2) + '\n'`, ensures the parent directory exists (`mkdirSync(dirname(file), { recursive: true })`), writes to `${file}.tmp`, then `renameSync(tmp, file)`.
  - `export function readJsonValidated<T>(file: string, schema: ZodType<T>, fallback: T): T` — returns `fallback` if the file is missing, JSON parse fails, or Zod `safeParse` fails. Imports the `ZodType` type from `zod` (or the project's existing alias). Optionally accepts a `{ warnOnInvalid?: boolean }` flag if needed to match callers; default behaviour follows current code: do not log on missing file, do log via `log.warn` only when validation of existing data fails AND the caller historically logged. Verify each consumer's behaviour while migrating; preserve it.
- [ ] Consumers migrated to use the shared helpers:
  - `src/lib/state.ts`: `readState`, `writeState` use the helpers; local `tmp/rename` code is gone.
  - `src/lib/queue.ts`: `readQueue` uses `readJsonValidated`; `appendToQueue` uses `atomicWriteJson`.
  - `src/lib/dedup-cache.ts`: `loadEntries` uses `readJsonValidated`; `recordHash` uses `atomicWriteJson`.
  - `src/lib/bootstrap.ts`: `readBootstrapState`, `writeBootstrapState` use the helpers.
  - `src/lib/proposal-drain.ts`: the local `atomicWriteJson` function is deleted; the file imports it from `./fs-atomic.js`.
  - `src/lib/lint-state.ts`: `readLintState`, `writeLintState` use the helpers.
- [ ] `rg -n 'renameSync\(' src/lib/` returns matches only in `src/lib/fs-atomic.ts` and `src/lib/nodes.ts` (nodes.ts writes markdown via `matter.stringify`, intentionally untouched).
- [ ] `rg -n "writeFileSync\(tmp" src/lib/` returns matches only in `src/lib/fs-atomic.ts` and `src/lib/nodes.ts`.
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript with Zod (`ZodType<T>` or `z.ZodTypeAny` per the version pinned in `package.json`).
- Node ESM imports (`.js` extensions on relative paths).
- `JSON.stringify(data, null, 2) + '\n'` for serialisation (matches every existing site).

## Input Dependencies
- Task 1 (compactStamp consolidation) — to avoid concurrent edits to `bootstrap.ts`, `curate.ts`, and `proposal-drain.ts`.

## Output Artifacts
- New file `src/lib/fs-atomic.ts`.
- Migrated consumers listed above.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Create `src/lib/fs-atomic.ts`:
   ```ts
   import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
   import { dirname } from 'node:path';
   import type { ZodType } from 'zod';

   export function atomicWriteJson(file: string, data: unknown): void {
     mkdirSync(dirname(file), { recursive: true });
     const tmp = `${file}.tmp`;
     writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
     renameSync(tmp, file);
   }

   export function readJsonValidated<T>(file: string, schema: ZodType<T>, fallback: T): T {
     if (!existsSync(file)) return fallback;
     try {
       const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
       const parsed = schema.safeParse(raw);
       if (parsed.success) return parsed.data;
       return fallback;
     } catch {
       return fallback;
     }
   }
   ```
   Confirm the project's `zod` re-export style (`import { z } from 'zod'`); if `ZodType` is not directly available, use `z.ZodTypeAny` and cast.
2. Migrate each consumer. Pattern:
   - Replace the `if (!existsSync(...)) return fallback; try { JSON.parse + safeParse } catch {}` block with `return readJsonValidated(file, Schema, fallback)`.
   - Replace `const tmp = …; writeFileSync(tmp, JSON.stringify(...)); renameSync(tmp, file)` with `atomicWriteJson(file, payload)`.
   - For files that also do `mkdirSync(dirname(file), { recursive: true })` before writing (e.g., `state.ts`, `lint-state.ts`), the `mkdirSync` becomes redundant once `atomicWriteJson` performs it; remove the line.
3. Per-file specifics:
   - `state.ts`: drop now-unused `mkdirSync`, `renameSync`, `writeFileSync`, and `readFileSync` imports.
   - `queue.ts`: same; pass `QueueFileSchema` and the empty-queue fallback.
   - `dedup-cache.ts`: same; pass `DedupCacheFileSchema` and `{ schema_version: 1, entries: [] }` as fallback to `readJsonValidated`, then read `.entries`. (Or keep the local `loadEntries` wrapper and have it call `readJsonValidated` internally.)
   - `bootstrap.ts`: `writeBootstrapState` currently calls `BootstrapStateSchema.parse(state)` before writing — keep that validation, then call `atomicWriteJson(file, validated)`.
   - `proposal-drain.ts`: delete the local `atomicWriteJson` (lines 309-313) and import from `./fs-atomic.js`.
   - `lint-state.ts`: same pattern; drop unused fs imports.
4. Update the imports list of every migrated file to drop now-unused `renameSync`, `writeFileSync`, `readFileSync`, `mkdirSync`, `existsSync` symbols if no other code in the file still needs them.
5. Verify:
   - `rg -n 'renameSync\(' src/lib/` → only `fs-atomic.ts` (and `nodes.ts`).
   - `npx tsc --noEmit && npm test` → green.
6. **Do NOT** modify `src/lib/nodes.ts`. It writes markdown via `matter.stringify`, not JSON; out of scope.

</details>
