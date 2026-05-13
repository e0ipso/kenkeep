---
id: 3
group: "library-swaps"
dependencies: [1, 2]
status: "completed"
created: 2026-05-13
skills: ["typescript", "unit-testing"]
---
# Replace ULID with crypto.randomUUID and drop the runId? test seam

## Objective
Delete `src/lib/ulid.ts`, inline `crypto.randomUUID()` at the two call sites, remove the `runId?: string` test seam from `BootstrapIncrementalContext` / curate's `CurateContext`, and update tests/docs that referenced the ULID shape to assert on UUID v4 shape.

## Skills Required
- `typescript`: refactor context interfaces, update call sites, remove dead exports.
- `unit-testing`: replace fixed-id injections with shape-matching regex assertions in Vitest.

## Acceptance Criteria
- [ ] `src/lib/ulid.ts` no longer exists.
- [ ] `rg -n "from .*ulid" src/ tests/` returns zero hits.
- [ ] `rg -n 'runId\?' src/` returns zero hits.
- [ ] `src/lib/bootstrap.ts` and `src/lib/curate.ts` use `randomUUID()` (imported from `node:crypto`) at the two former `ulid(now())` sites; the `runId?: string` field is removed from `BootstrapIncrementalContext` and curate's analogue.
- [ ] `src/commands/curate.ts` no longer imports `ulid`; it calls `randomUUID()` directly (around line 50).
- [ ] Tests in `tests/lib/bootstrap.test.ts`, `tests/lib/curate.test.ts`, and any hook tests that previously asserted on a deterministic run-id now assert on the UUID v4 shape, e.g. `expect(runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)`, or against the equivalent shape in log-file paths.
- [ ] Documentation strings that called out ULID are updated:
  - `IMPLEMENTATION.md`: the line in §curate logs that says "short ULID generated at the start" is replaced with "UUID v4 generated at the start".
  - `docs/internals/schemas.md` line 112: `curator_run_id: <ULID>` → `curator_run_id: <UUID>`.
  - `docs/internals/architecture.md` line 102: drop or rewrite the "ULID is the only randomness" bullet.
  - `.ai/knowledge-base/nodes/practice/practice-determinism-contract.md`: replace "ULID is the only source of randomness" wording with "`crypto.randomUUID()` is the only source of randomness, scoped to `run_id` minting." in both the summary frontmatter field and the body bullet.
- [ ] `npx tsc --noEmit` exits 0; `npm test` exits 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- `import { randomUUID } from 'node:crypto'`.
- The `run_id` Zod schema (`src/lib/schemas.ts:221`) is already `z.string()` — no schema change required.

## Input Dependencies
- Tasks 1 and 2 — they touch `bootstrap.ts`, `curate.ts`, and `proposal-drain.ts`, so sequencing avoids merge conflicts.

## Output Artifacts
- Deletion of `src/lib/ulid.ts`.
- Updated `src/lib/bootstrap.ts`, `src/lib/curate.ts`, `src/commands/curate.ts`.
- Updated tests (`tests/lib/bootstrap.test.ts`, `tests/lib/curate.test.ts`, plus any hook tests that match).
- Updated docs (`IMPLEMENTATION.md`, `docs/internals/schemas.md`, `docs/internals/architecture.md`, `.ai/knowledge-base/nodes/practice/practice-determinism-contract.md`).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Delete `src/lib/ulid.ts`.
2. **`src/lib/bootstrap.ts`**:
   - Remove `import { ulid } from './ulid.js';`.
   - Add `import { randomUUID } from 'node:crypto';` to the existing `node:crypto` import (or as a new line if absent).
   - Change line 458 from `const runId = ctx.runId ?? ulid(now());` to `const runId = randomUUID();`.
   - Remove the `runId?: string;` field from `BootstrapIncrementalContext` (line 73) and any other context interface in this file (line 99 looks like the same pattern in another interface — remove there too if present).
3. **`src/lib/curate.ts`**: identical pattern — remove the `ulid` import, add `randomUUID` import (or use the existing one), change line 309 to `const runId = randomUUID();`, and drop both `runId?: string;` fields (lines 65 and 80).
4. **`src/commands/curate.ts`**: remove the `ulid` import; change line 50 from `const runId = ulid(now);` to `const runId = randomUUID();`. Add the `randomUUID` import from `node:crypto`.
5. **Tests** — search and update:
   - `rg -n 'runId' tests/` to find every fixture or assertion.
   - Replace patterns like `await runBootstrapIncremental({ ..., runId: 'fixed-id' })` and subsequent `expect(result.runId).toBe('fixed-id')` with the actual returned UUID checked against the regex above.
   - For tests that asserted exact log-file paths containing the fixed run-id, switch to `expect(result.logFile).toMatch(/[0-9a-f-]{36}__\d{8}T\d{6}Z\.jsonl$/)`.
   - Affected suites likely include `tests/lib/bootstrap.test.ts`, `tests/lib/curate.test.ts`, and any tests in `tests/commands/` or `tests/hooks/` that read a log filename.
6. **Docs**:
   - `IMPLEMENTATION.md` line 410: rewrite to "UUID v4 generated at the start of `/kb-curate`".
   - `docs/internals/schemas.md` line 112: `<ULID>` → `<UUID>`.
   - `docs/internals/architecture.md` line 102: change wording so it no longer claims ULID. Suggested: "- `crypto.randomUUID()` is the only randomness, scoped to `run_id` minting."
   - `.ai/knowledge-base/nodes/practice/practice-determinism-contract.md`: edit both the frontmatter `summary` field and the matching body bullet.
7. Run `npx tsc --noEmit && npm test`. Iterate on test fixes until green.

</details>
