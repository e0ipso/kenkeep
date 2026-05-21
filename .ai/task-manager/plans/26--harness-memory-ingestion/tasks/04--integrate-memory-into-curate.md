---
id: 4
group: "pipeline-integration"
dependencies: [2]
status: "pending"
created: 2026-05-21
skills:
  - typescript
---
# Wire memory candidates into `curate`

## Objective
Have `curate` feed harness memory files to the curator alongside pending session logs, carrying explicit `harness-memory` provenance metadata that the curator can attribute in node frontmatter and conflict files. Ledger updates only on successful curate runs.

## Skills Required
- typescript (curate input builder; provenance plumbing)

## Acceptance Criteria
- [ ] `src/lib/curate.ts` (the curator input builder) accepts and merges `CurateMemoryCandidate[]` alongside its existing pending-session-log input. The merged input set is what the curator prompt receives.
- [ ] Each memory candidate's metadata in the curator input includes at least `{ source: 'harness-memory', iri: file://... }` so the curator prompt and resulting node frontmatter can attribute origin.
- [ ] `src/commands/curate.ts` resolves the active harness, invokes `discoverHarnessMemoryFiles({ adapter, paths })`, and threads `curateCandidates` into the curator input builder.
- [ ] Conflict-file handling is unchanged: if a memory candidate contradicts an existing node, the curator writes a conflict file under `.ai/knowledge-base/conflicts/` (existing behaviour). The conflict file references the memory IRI in its provenance section.
- [ ] After the curate run completes, the command calls `memory.commit(runId, succeeded)`. `succeeded` is `true` only when the curator's run finished without throwing and the curator considers its output durable (conflict files written count as success — they are the curator's normal output).
- [ ] CI guard is unchanged.
- [ ] `npm run typecheck` and `npm run lint` pass.

## Technical Requirements
- Do not change the curator prompt template here unless absolutely required to surface provenance. If a prompt change is needed, bump the prompt's `Version: N` comment per `practice-bump-prompt-version-comment`.
- Memory candidates and session-log entries share whatever envelope the curator already consumes (one "input record" per item). Pick the smallest faithful adapter from `CurateMemoryCandidate` into that shape — do not invent a new shape.

## Input Dependencies
- Task 2 — `discoverHarnessMemoryFiles` exists and exposes `curateCandidates` + `commit`.

## Output Artifacts
- Updated `src/lib/curate.ts`.
- Updated `src/commands/curate.ts`.

## Implementation Notes

<details>
<summary>Wiring details</summary>

Sketch for `src/commands/curate.ts`:

```ts
const adapter = resolveActiveHarness({ /* existing args */ });
const paths = repoPaths(repoRoot);
const memory = await discoverHarnessMemoryFiles({ adapter, paths });
const runId = /* existing run id */;
let succeeded = false;
try {
  const result = await runCurate({
    /* existing fields */,
    memoryCandidates: memory.curateCandidates,
  });
  succeeded = result.ok ?? true;
  return result;
} finally {
  await memory.commit(runId, succeeded);
}
```

For `src/lib/curate.ts`:

- Add `memoryCandidates?: CurateMemoryCandidate[]` to whatever input options the function already accepts.
- When building the curator's input list, append the memory candidates after pending session logs. Each entry should carry the existing per-record shape with the addition of provenance metadata visible to the prompt template.
- If the curator's input is shipped as a JSON envelope to the LLM, ensure `{ source: 'harness-memory', iri }` is preserved through serialisation.

Open the curate prompt template only to verify that the existing input-record shape gracefully accommodates the extra `source`/`iri` fields. If it ignores unknown fields (most likely), no prompt change is needed. If it strictly enumerates shapes, add a one-line "Memory candidates also appear with `source: harness-memory`" and bump the `Version:` comment.
</details>
