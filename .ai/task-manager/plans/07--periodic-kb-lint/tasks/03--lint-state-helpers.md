---
id: 3
group: "state"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - typescript
---
# Lint state schema and read/write helpers

## Objective

Add a separate persisted state file (`.ai/knowledge-base/.state/lint-state.json`) that records the session counter and the summary of the last lint run. Provide a Zod schema, an atomic writer, and a tolerant reader. Keep the existing `state.json` shape untouched.

## Skills Required

- typescript: zod schema declaration, atomic file write (temp + rename) mirroring `src/lib/state.ts`.

## Acceptance Criteria

- [ ] New schema `LintStateFileSchema` exported from `src/lib/schemas.ts` with shape:
  - `schema_version: z.literal(1)`
  - `sessions_since_last_lint: z.number().int().nonnegative()`
  - `last_lint_at: z.string().nullable()` (ISO timestamp; `null` if never run)
  - `last_errors: z.number().int().nonnegative()`
  - `last_findings: z.number().int().nonnegative()`
- [ ] Exported type alias `LintStateFile = z.infer<typeof LintStateFileSchema>`.
- [ ] New file `src/lib/lint-state.ts` exports:
  - `DEFAULT_LINT_STATE: LintStateFile` = `{ schema_version: 1, sessions_since_last_lint: 0, last_lint_at: null, last_errors: 0, last_findings: 0 }`.
  - `readLintState(file: string): LintStateFile`: returns `DEFAULT_LINT_STATE` on missing/unparseable/schema-failing file (matches `readState` tolerance pattern).
  - `writeLintState(file: string, state: LintStateFile): void`: atomic write via `tmp` + `renameSync` (matches `writeState`). Creates `dirname` recursively.
  - `lintStateFile(stateDir: string): string`: convenience helper returning `join(stateDir, 'lint-state.json')`.
- [ ] No mutation of `StateFileSchema` or `state.json` shape.
- [ ] `npm run typecheck` is clean.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `src/lib/schemas.ts` (add schema next to existing `StateFileSchema` around lines 104-110) and new file `src/lib/lint-state.ts` (mirror `src/lib/state.ts` layout).
- Atomic write pattern from `src/lib/state.ts`:

  ```ts
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(tmp, file);
  ```

- Tolerant read pattern (existsSync → JSON.parse-in-try → safeParse → fall back to defaults).

## Input Dependencies

None.

## Output Artifacts

- Edited `src/lib/schemas.ts` (new `LintStateFileSchema` + type).
- New `src/lib/lint-state.ts` with `readLintState`, `writeLintState`, `lintStateFile`, `DEFAULT_LINT_STATE`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. Open `src/lib/schemas.ts`. After `StateFileSchema` (around line 110), add:

   ```ts
   export const LintStateFileSchema = z.object({
     schema_version: z.literal(1),
     sessions_since_last_lint: z.number().int().nonnegative(),
     last_lint_at: z.string().nullable(),
     last_errors: z.number().int().nonnegative(),
     last_findings: z.number().int().nonnegative(),
   });
   export type LintStateFile = z.infer<typeof LintStateFileSchema>;
   ```

2. Create `src/lib/lint-state.ts`:

   ```ts
   import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
   import { dirname, join } from 'node:path';
   import { LintStateFileSchema, type LintStateFile } from './schemas.js';

   export const DEFAULT_LINT_STATE: LintStateFile = {
     schema_version: 1,
     sessions_since_last_lint: 0,
     last_lint_at: null,
     last_errors: 0,
     last_findings: 0,
   };

   export function lintStateFile(stateDir: string): string {
     return join(stateDir, 'lint-state.json');
   }

   export function readLintState(file: string): LintStateFile {
     if (!existsSync(file)) return { ...DEFAULT_LINT_STATE };
     try {
       const raw = JSON.parse(readFileSync(file, 'utf8')) as unknown;
       const parsed = LintStateFileSchema.safeParse(raw);
       if (parsed.success) return parsed.data;
       return { ...DEFAULT_LINT_STATE };
     } catch {
       return { ...DEFAULT_LINT_STATE };
     }
   }

   export function writeLintState(file: string, state: LintStateFile): void {
     mkdirSync(dirname(file), { recursive: true });
     const tmp = `${file}.tmp`;
     writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
     renameSync(tmp, file);
   }
   ```

3. Do not add helpers beyond the four listed exports. Hook-side logic (increment, reset, threshold compare) belongs in the SessionEnd hook task (task 5), not here.

4. No retrospective comments. No schema-version bump.

</details>
