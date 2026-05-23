---
id: 3
group: "cli-primitives"
dependencies: []
status: "completed"
created: 2026-05-23
skills:
  - typescript
  - unit-testing
---
# Add `curate dedup` CLI primitive

## Objective
Expose the deterministic curator dedup step — `dedupActions` + `${runId}-${n}` conflict-ID minting + `curator_processed_at` / `curator_run_id` session-frontmatter stamping — as a standalone `ai-kb curate dedup --input <proposals.json>` command. The `kb-curate` skill will pipe its in-prompt-drafted proposal set through this command in a single atomic transaction.

## Skills Required
- `typescript` — implement the new commander subcommand reusing existing curate library code.
- `unit-testing` — assert byte-identical determinism across repeated runs and against a golden fixture.

## Acceptance Criteria
- [ ] New file `src/commands/curate-dedup.ts` (or matching the existing `curate` namespace pattern), registered with `commander`.
- [ ] Reads proposals JSON from `--input <path>` (or stdin); validates against the curator-proposal schema; nonzero exit on bad input with no side effects.
- [ ] Runs `dedupActions` (`src/lib/curate.ts:477-492` per the plan), mints conflict-file IDs as `${runId}-${n}` (lines 316, 394), and applies the `curator_processed_at` / `curator_run_id` frontmatter stamp to consumed session files (lines 523-532) — all in one invocation.
- [ ] Atomic: either all writes (surviving proposals + conflicts + session stamps) land, or the filesystem is left as it was. Use `src/lib/fs-atomic.ts`.
- [ ] Deterministic: given the same input JSON and the same `--run-id`, produces byte-identical output and byte-identical on-disk side effects across repeated runs. Locked down by a golden-fixture test.
- [ ] `--run-id <id>` flag is accepted (so the caller controls run identity for reproducibility) and defaults to a time-based ID matching today's runner behavior when omitted.
- [ ] Tests: (a) golden fixture for the dedup output, (b) three repeated runs produce byte-identical results, (c) session-file frontmatter stamps land on the right files.
- [ ] Pure Node — no sub-agent, no LLM.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Lift `dedupActions`, the conflict-ID minter, and `markSessionsProcessed` (or its equivalent) out of `CuratorRunner` if they are not already exported from `src/lib/curate.ts`. The runner itself stays alive in this task; Task 6 deletes it.
- Schema: reuse the existing curator-proposal Zod schema in `src/lib/schemas.ts`. If the schema only existed as a runtime check inside the runner, factor it into `schemas.ts` here.

## Input Dependencies
None — pure primitive.

## Output Artifacts
- `ai-kb curate dedup` CLI command consumed by Task 4's rewritten `kb-curate` skill.
- Exported pure functions (`dedupActions`, conflict-ID minter, session-stamper) that survive the runner deletion in Task 6.

## Implementation Notes
<details>
<summary>Details</summary>

- The plan's success criterion #2 requires byte-for-byte match against pre-change runner output for the same proposal JSON. To make that achievable, do **not** change `dedupActions` semantics in this task — just expose it. Any behavior changes must come in a separate plan.
- The order of operations matters for atomicity: collect every intended write into memory, do schema validation on the merged result, then perform the tmp+rename writes in a fixed order (surviving proposals → conflicts → session stamps). If a later write fails, prior writes are already on disk — accept this and document; the alternative (rollback) is over-engineering for a primitive that runs in a single-author session.
- The conflict-ID counter must be reset per invocation, not persisted across invocations. Verify by running the command twice with the same input and confirming identical IDs both times.
- Stdout: emit a structured summary (JSON, one line) describing how many proposals were kept, how many became conflicts, and how many session files were stamped. The skill uses this to report results to the user.
- Tests under `test/fixtures/curate/proposals/` per validation step #2 in the plan.

</details>
