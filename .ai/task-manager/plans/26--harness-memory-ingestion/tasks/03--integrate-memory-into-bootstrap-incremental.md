---
id: 3
group: "pipeline-integration"
dependencies: [2]
status: "pending"
created: 2026-05-21
skills:
  - typescript
---
# Wire memory candidates into `bootstrap-incremental`

## Objective
Have `bootstrap-incremental` discover the active harness's memory files via `discoverHarnessMemoryFiles` and feed them into the bootstrap pipeline alongside markdown candidates, with collision/chunking/locking behaviour unchanged. The ledger updates only on successful completion of the run.

## Skills Required
- typescript (pipeline wiring; existing bootstrap module conventions)

## Acceptance Criteria
- [ ] `BootstrapContext` in `src/lib/bootstrap.ts` gains an optional `memoryCandidates?: DocCandidateFile[]` field.
- [ ] `runBootstrapIncremental` concatenates `memoryCandidates ?? []` with the markdown candidates produced by `discoverMarkdownFiles`. Memory candidates bypass `STATIC_SKIPS` (those are markdown-filename heuristics).
- [ ] Existing collision detection — i.e. skipping when a node file with the same target name already exists — still applies to memory candidates exactly as for markdown candidates.
- [ ] `src/commands/bootstrap-incremental.ts` resolves the active harness (existing flow), invokes `discoverHarnessMemoryFiles({ adapter, paths })`, and threads the result's `bootstrapCandidates` into `BootstrapContext.memoryCandidates`.
- [ ] After the bootstrap run completes, the command calls `commit(runId, succeeded)`; on failure path (thrown error or non-zero pipeline status) `commit(runId, false)` is invoked so the ledger is not poisoned.
- [ ] CI guard is unchanged and still refuses to run in CI (no new code path bypasses it).
- [ ] `npm run typecheck` and `npm run lint` pass.

## Technical Requirements
- Do not duplicate harness resolution; reuse the existing `resolveActiveHarness` call.
- Reuse the existing run lock (`proper-lockfile` based); no new lock.
- `runId` should be the same identifier the existing bootstrap state writes use (look up the current source of truth — `runBootstrapIncremental` likely already generates one). If not, generate via `crypto.randomUUID()`.

## Input Dependencies
- Task 2 — `discoverHarnessMemoryFiles` and `RepoPaths.memoryLedgerFile` exist.

## Output Artifacts
- Updated `src/lib/bootstrap.ts` (`BootstrapContext`, `runBootstrapIncremental`).
- Updated `src/commands/bootstrap-incremental.ts`.

## Implementation Notes

<details>
<summary>Wiring details</summary>

In `src/lib/bootstrap.ts`:

```ts
export interface BootstrapContext {
  // ...existing fields...
  memoryCandidates?: DocCandidateFile[];
}

export async function runBootstrapIncremental(ctx: BootstrapContext): Promise<BootstrapResult> {
  // ...existing discovery...
  const markdownCandidates = candidates;        // existing variable
  const memoryCandidates = ctx.memoryCandidates ?? [];
  const allCandidates = [...markdownCandidates, ...memoryCandidates];
  // continue with allCandidates wherever `candidates` was used
}
```

In `src/commands/bootstrap-incremental.ts` (sketch):

```ts
const adapter = resolveActiveHarness({ /* existing args */ });
const paths = repoPaths(repoRoot);
const memory = await discoverHarnessMemoryFiles({ adapter, paths });
const runId = /* existing run id, or randomUUID() */;
let succeeded = false;
try {
  const result = await runBootstrapIncremental({
    /* existing fields */,
    memoryCandidates: memory.bootstrapCandidates,
  });
  succeeded = result.ok ?? true;
  return result;
} finally {
  await memory.commit(runId, succeeded);
}
```

Edge: if the command short-circuits (e.g. dry-run prints candidates without running the LLM), still treat that as a non-commit (`succeeded = false`) so the user can re-run for real. Dry-run output should include memory candidates so the user can see them.
</details>
