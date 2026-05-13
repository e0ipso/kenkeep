---
id: 1
group: "dedup-helpers"
dependencies: []
status: "completed"
created: 2026-05-13
skills: ["typescript"]
---
# Consolidate compactStamp into src/lib/time.ts

## Objective
Eliminate the three byte-identical `compactStamp` / `isoToCompactStamp` definitions by introducing a single `src/lib/time.ts` export and updating the three call sites.

## Skills Required
- `typescript`: extract function, update imports across three files.

## Acceptance Criteria
- [ ] `src/lib/time.ts` exists and exports `export function compactStamp(d: Date): string` returning `YYYYMMDDThhmmssZ` (UTC).
- [ ] `src/lib/bootstrap.ts` imports `compactStamp` from `./time.js`; the local `compactStamp` function is deleted.
- [ ] `src/lib/curate.ts` imports `compactStamp` from `./time.js`; the local `compactStamp` function is deleted.
- [ ] `src/lib/proposal-drain.ts` imports `compactStamp` from `./time.js`; the local `isoToCompactStamp` function is deleted and the call site in `proposalLogPath` switched to `compactStamp`.
- [ ] `rg -n 'function (compactStamp|isoToCompactStamp)' src/` returns exactly one match (in `src/lib/time.ts`).
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- TypeScript, Node ESM imports (relative imports use the `.js` extension under TS).
- Signature: `(d: Date) => string`. Output format: `YYYYMMDDThhmmssZ` using UTC components.

## Input Dependencies
None.

## Output Artifacts
- New file `src/lib/time.ts`.
- Updated `src/lib/bootstrap.ts`, `src/lib/curate.ts`, `src/lib/proposal-drain.ts`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Create `src/lib/time.ts` with:
   ```ts
   export function compactStamp(d: Date): string {
     const pad = (n: number): string => n.toString().padStart(2, '0');
     return (
       `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
       `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
     );
   }
   ```
2. In `src/lib/bootstrap.ts`: add `import { compactStamp } from './time.js';` near the other relative imports and delete the local `compactStamp` function (around lines 606-612).
3. In `src/lib/curate.ts`: add the same import and delete the local `compactStamp` function (around lines 540-546).
4. In `src/lib/proposal-drain.ts`: add the same import, change `proposalLogPath` to call `compactStamp(when)` instead of `isoToCompactStamp(when)`, and delete the local `isoToCompactStamp` (around lines 236-242).
5. Run `npx tsc --noEmit` and `npm test`. No test changes expected: behaviour is byte-identical.

</details>
