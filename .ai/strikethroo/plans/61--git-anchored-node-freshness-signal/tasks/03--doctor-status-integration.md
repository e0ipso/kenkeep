---
id: 3
group: "surfaces"
dependencies: [1]
status: "completed"
created: 2026-07-07
skills:
  - typescript
  - vitest
---
# Surface freshness in `doctor` and `status`

## Objective
Report the freshness signal on the two existing read commands: an advisory (warn-level, never failing) `doctor` check and a summary line in `status`. Both consume the shared freshness core; neither re-implements git logic or changes its command contract.

## Skills Required
TypeScript edits to `src/commands/doctor.ts` and `src/commands/status.ts`, plus Vitest coverage.

## Acceptance Criteria
- [ ] `doctor` gains a check named e.g. "nodes may describe changed code" that reports the flagged count. It is **warn-level only** and never increments the failure count, so `doctor`'s exit code is unchanged by this signal.
- [ ] The `doctor` check degrades cleanly: when node frontmatter cannot be enumerated (mirrors the existing dangling-`derived_from` skip) or the tree is not a git repo / the core returns empty, it reports an informational "no signal / skipped" result rather than a warning or error.
- [ ] `status` prints one additional line under the knowledge-base section, e.g. "Nodes describing changed code: N", sourced from the same core.
- [ ] No change to `doctor`'s or `status`'s existing lines, ordering of unrelated checks, or exit-code semantics beyond the single added line/check.
- [ ] `npm test -- tests/doctor.test.ts <and the status suite>` exits 0 and asserts the new advisory check is warn-not-error and that `status` prints the flagged-count line.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse `computeFreshness`/`FreshnessReport` from Task 1. Call it once per command; do not duplicate git logic.
- In `doctor.ts`, add the check via the existing `CheckResult`/`NamedCheck` machinery using the `warn(...)`/`ok(...)` helpers; ensure it is in the `warnings` bucket, never `failures`. Follow how `danglingResult` is computed and gated on `frontmatterCheck.canEnumerate`.
- In `status.ts`, add the line near the "Knowledge base" block using the existing `log.plain` pattern; degrade to `0`/"n/a" quietly when the core returns empty (consistent with `countNodes` degrading to zeros).
- Do not introduce new exit conditions or change existing check text.

## Input Dependencies
Task 1 (`computeFreshness`, `FreshnessReport`).

## Output Artifacts
Edited `src/commands/doctor.ts` and `src/commands/status.ts`, plus updated/added tests. Documented in Task 5.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. `doctor.ts`: add a `NamedCheck` after the `derived_from references resolve` check. Compute the freshness report once; if `frontmatterCheck.canEnumerate` is false, emit a skipped/`ok`-style advisory (do not warn on a tree you couldn't read). Otherwise, `flaggedCount === 0` → `ok('no nodes appear to describe changed code')`; `> 0` → `warn('N node(s) may describe changed code; run `npx kenkeep freshness --verbose`.')`. Confirm the run still returns `0` failures for a flagged fixture.
3. `status.ts`: add the summary line under "Knowledge base". Wrap the core call so an empty report prints `0`.
4. Keep both strictly additive — the existing test assertions for unrelated checks/lines must still pass.
5. Test philosophy — write a few tests, mostly integration. Assert the warn-not-error behavior in `doctor` (exit code unchanged with a flagged fixture) and the presence of the `status` line. Reuse the git-fixture helper from Task 1 where possible; do not re-test the core's internals.
</details>
