---
id: 3
group: "batching"
dependencies: [1, 2]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Add shared `chunk` helper, swap bootstrap and curate to count-based batching, delete `--token-budget`

## Objective

Replace the token-budget batching in `bootstrap.ts` and `curate.ts` with a shared, count-based `chunk(items, size)` helper. Delete the `--token-budget` CLI flag and all `tokenBudget` plumbing.

## Skills Required

- `typescript`: edit lib + command + CLI files; preserve the existing public surface where the plan does not call for removal.

## Acceptance Criteria

- [ ] New file `src/lib/chunk-batch.ts` exports `function chunk<T>(items: T[], size: number): T[][]`. Behavior: walks items left-to-right, emits arrays of length `size`; the last batch may be shorter. Throws on `size <= 0`. No other exports.
- [ ] `src/lib/bootstrap.ts`: `CHARS_PER_TOKEN`, `DEFAULT_TOKEN_BUDGET`, and `chunkDocs` are deleted. `BootstrapContext.tokenBudget` is removed. Both `chunkDocs(candidates, tokenBudget).length` and `chunkDocs(candidates, tokenBudget)` call sites become `chunk(candidates, BOOTSTRAP_BATCH_SIZE).length` / `chunk(candidates, BOOTSTRAP_BATCH_SIZE)` with `const BOOTSTRAP_BATCH_SIZE = 20;` at module scope.
- [ ] `src/lib/curate.ts`: `CHARS_PER_TOKEN`, `DEFAULT_TOKEN_BUDGET`, `batchSessions`, and `estimateSessionTokens` are deleted. `CurateContext.tokenBudget` is removed. The `batchSessions(pending, batchSize, tokenBudget)` call becomes `chunk(pending, CURATE_BATCH_SIZE)` with `const CURATE_BATCH_SIZE = 10;` at module scope. The existing `batchSize` ctx option (if separate from `tokenBudget`) is dropped or replaced — there should be exactly one count-based control, and it is the constant.
- [ ] `src/commands/bootstrap-incremental.ts` and `src/commands/curate.ts` no longer have a `tokenBudget?: number` field on their option types and no longer forward `tokenBudget` to the context.
- [ ] `src/cli.ts`: the `--token-budget` option on the `bootstrap-incremental` command and the `--token-budget` option on the `curate` command (if present) are removed, including the typed `tokenBudget?: number` fields and the conditional plumbing to the command-options object.
- [ ] `rg -n "CHARS_PER_TOKEN|DEFAULT_TOKEN_BUDGET" src` returns exactly one hit: `src/lib/index-gen.ts` (intentionally untouched).
- [ ] `rg -n "chunkDocs|batchSessions|estimateSessionTokens|tokenBudget" src` returns zero hits.
- [ ] `npm run build` succeeds.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- `src/lib/index-gen.ts` MUST stay untouched; its `CHARS_PER_TOKEN` is for INDEX node-count display, not batching.
- Preserve the order and identity of items in the batches; `chunk` is a pure slicing helper.
- The batch-size constants (`20`, `10`) are intentional per plan clarification; do not parameterize them.

## Input Dependencies

Task 1 (schema reduction) — `bootstrapTokenBudget` is gone from settings.
Task 2 — `commands/bootstrap-incremental.ts` no longer reads `settings.bootstrapTokenBudget`.

## Output Artifacts

- `src/lib/chunk-batch.ts` (new).
- `src/lib/bootstrap.ts`, `src/lib/curate.ts`, `src/commands/bootstrap-incremental.ts`, `src/commands/curate.ts`, `src/cli.ts` (edited).

## Implementation Notes

<details>
<summary>chunk helper</summary>

```ts
// src/lib/chunk-batch.ts
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || !Number.isInteger(size)) {
    throw new Error(`chunk size must be a positive integer, got ${size}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
```

</details>

<details>
<summary>bootstrap.ts edits</summary>

- Delete lines 27-29 (`DEFAULT_TOKEN_BUDGET`, `CHARS_PER_TOKEN`).
- Delete the `chunkDocs` function (lines ~293-309).
- In `BootstrapContext`, delete `tokenBudget?: number;` (line ~67). Keep `lockTtlMs?: number;` for now.
- Add `const BOOTSTRAP_BATCH_SIZE = 20;` near the top of the file.
- Replace the two `chunkDocs(...)` call sites (lines ~431, ~468) with `chunk(candidates, BOOTSTRAP_BATCH_SIZE)`.
- Replace `const tokenBudget = ctx.tokenBudget ?? DEFAULT_TOKEN_BUDGET;` (line ~351) by deleting the line and any downstream `tokenBudget` reference.
- Import: `import { chunk } from './chunk-batch.js';`.

</details>

<details>
<summary>curate.ts edits</summary>

- Delete lines 32-34 (`DEFAULT_TOKEN_BUDGET`, `CHARS_PER_TOKEN`).
- Delete `batchSessions` (lines ~154-) and `estimateSessionTokens` (lines ~177-).
- In `CurateContext`, delete `tokenBudget?: number;` (line ~59). If there is also a `batchSize?: number;` field used only by the deleted `batchSessions`, remove it too unless tests in task 5 require it.
- Add `const CURATE_BATCH_SIZE = 10;` near the top of the file.
- Replace the `batchSessions(pending, batchSize, tokenBudget)` call (line ~314) with `chunk(pending, CURATE_BATCH_SIZE)`.
- Delete the line that resolves `tokenBudget` from ctx (line ~269) and any related `const batchSize = ...` reading from ctx.
- Import: `import { chunk } from './chunk-batch.js';`.

</details>

<details>
<summary>commands and CLI</summary>

- `src/commands/bootstrap-incremental.ts`: remove `tokenBudget?: number;` from `BootstrapIncrementalOptions`, the `if (opts.tokenBudget !== undefined) ctx.tokenBudget = opts.tokenBudget;` block, and any other `tokenBudget` references.
- `src/commands/curate.ts`: remove the `...(opts.tokenBudget !== undefined ? { tokenBudget: opts.tokenBudget } : {})` spread on line ~108 and the `tokenBudget?: number;` field on `CurateOptions`.
- `src/cli.ts` (lines ~101, 107, 113-114 for curate; lines ~152, 160, 166-167 for bootstrap-incremental): remove the typed `tokenBudget?: number` fields, the `--token-budget <n>` option registration (search for it), and the conditional assignment lines. Do NOT remove unrelated flags.

</details>
