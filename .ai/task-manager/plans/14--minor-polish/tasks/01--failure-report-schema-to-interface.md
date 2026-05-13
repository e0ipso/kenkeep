---
id: 1
group: "minor-polish"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - typescript
---
# Replace `FailureReportSchema` Zod object with plain `interface FailureReport`

## Objective
Delete the `FailureReportSchema` Zod object in `src/lib/schemas.ts` and replace its type derivation with a plain `interface FailureReport` declared in the same file. The schema exists only to derive the type and is never used as a validator.

## Skills Required
- `typescript`: edit `src/lib/schemas.ts`, keep the existing `FailureReport` export name and shape so downstream type imports (`src/lib/curate.ts`) keep compiling unchanged.

## Acceptance Criteria
- [ ] `rg -n 'FailureReportSchema' src/ tests/` returns zero hits.
- [ ] `FailureReport` is exported from `src/lib/schemas.ts` as a TypeScript `interface` (or `type`) with the same field set the Zod object declared.
- [ ] Every existing consumer of `FailureReport` (`src/lib/curate.ts:19,86,349,409`) compiles without modification.
- [ ] No `z.infer<typeof FailureReportSchema>` references remain.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- The only consumer of `FailureReport` is `src/lib/curate.ts`. Per the plan's clarifications, leave the interface in `src/lib/schemas.ts` (lowest churn).
- The Zod object lives at `src/lib/schemas.ts:240-246`. Preserve the surrounding comment/section if any.
- Do not touch `DedupCacheEntrySchema`, `QueueEntrySchema`, `BootstrapDocEntrySchema` (referenced as nested Zod values by outer schemas; out of scope per the plan's clarifications). `StateLockSchema` is removed by task 02, not this task.

## Input Dependencies
None.

## Output Artifacts
- Edited `src/lib/schemas.ts`: `FailureReportSchema` removed, `interface FailureReport` (or `type FailureReport`) declared in its place.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Read `src/lib/schemas.ts` around lines 240-246 to confirm the current Zod shape of `FailureReportSchema`.
2. Replace the Zod block:
   ```ts
   export const FailureReportSchema = z.object({ ... });
   export type FailureReport = z.infer<typeof FailureReportSchema>;
   ```
   with a plain interface declaration that mirrors the field set:
   ```ts
   export interface FailureReport {
     // ...exact fields, optionality, and types from the original Zod object
   }
   ```
   Keep the export name `FailureReport` so consumers do not change.
3. Sanity-check field-by-field: for each Zod field (`z.string()`, `z.string().optional()`, `z.number()`, etc.) emit the equivalent TS type (`string`, `string | undefined`, `number`, etc.). Optional fields use `field?: T` in the interface.
4. Run `npx tsc --noEmit` and `npm test`. Both must pass.
5. Final sweep: `rg -n 'FailureReportSchema' .` returns no hits outside archived plans or CHANGELOG.

</details>
