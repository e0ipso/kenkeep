---
id: 4
group: "surfaces"
dependencies: [1]
status: "pending"
created: 2026-07-07
skills:
  - typescript
  - vitest
complexity_score: 5
complexity_notes: "Must add a git-backed advisory to the synchronous hot-path SessionStart builder under a hard budget that fails open, without altering the rest of the payload or making the hook async."
---
# Budgeted, fail-open SessionStart freshness advisory

## Objective
Emit one advisory line at SessionStart when nodes may describe changed code — naming the branch(es) with the most flagged nodes so a descending agent applies mild skepticism. The computation requires git, so it runs under a hard budget and fails open: on any error, non-git tree, empty tree, or budget overrun, no line is emitted and startup proceeds unchanged. The context hook stays synchronous and is never routed through the async launcher.

## Skills Required
TypeScript edits to `src/lib/session-start.ts` (actionable-signal path) and Vitest coverage of the appear/omit behavior.

## Acceptance Criteria
- [ ] When nodes are flagged, `buildSessionStartContext` includes one freshness advisory signal via the existing `buildActionableSignals`/`buildActionableBlock` path, worded like "nodes under `<branch>/` may be stale — code changed since curation." naming the most-affected branch(es).
- [ ] The advisory is computed under a hard budget and **fails open**: on any git error, a non-git tree, an empty/unreadable tree, or exceeding the budget, no advisory line is added and the rest of the `additionalContext` payload is byte-identical to today.
- [ ] The SessionStart context hook remains synchronous and is not routed through the async launcher; no new blocking or unbounded git work is added to the hot path.
- [ ] When no nodes are flagged (or the signal is unavailable), the SessionStart output is unchanged from current behavior — the advisory is strictly additive.
- [ ] `npm test -- tests/hooks/kk-session-start.test.ts <and/or the session-start lib suite>` exits 0 and asserts: the advisory appears for a flagged fixture; it is omitted (fail-open) on git failure/overrun; and the existing payload is otherwise unchanged.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Reuse `computeFreshness`/`FreshnessReport` from Task 1. Do not duplicate git logic. If the core needs a budget/deadline hook to satisfy the hot-path constraint, thread a small optional bound through the core rather than re-implementing it here.
- Integrate into `buildSessionStartContext` by extending `buildActionableSignals` (and its `SessionStartResult`) with an optional freshness signal; keep the existing signals (index-stale, curation, lint) and their ordering intact.
- Follow the project's existing "short hard deadline, fails open" discipline (as the prompt-time hook does): a missing/slow/erroring signal yields no context, never an exception, never a delay.
- Provide the repo root and nodes dir to the core the same way the builder already derives `repoRoot`/reads nodes; do not add a new persisted state read/write for this.

## Input Dependencies
Task 1 (`computeFreshness`, `FreshnessReport`).

## Output Artifacts
Edited `src/lib/session-start.ts` (and, if needed, a small optional budget parameter on the Task 1 core) plus tests. Documented in Task 5.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Add an optional freshness input to `SessionStartContext` or compute it inside the builder guarded by try/catch and a budget. The safest shape: compute the report inside a `try` that is bounded (small op cap / short deadline) and returns `null` on any failure; only when non-null and `flaggedCount > 0` push a new `ActionableSignal` (choose a moderate severity so it sorts sensibly among the existing signals).
3. Reuse `perBranch` from the report to name the top branch(es) in the advisory copy.
4. Absolutely do not make the hook async or move it to the async launcher; AGENTS.md requires context-producing hooks to stay synchronous. The budget must cap the synchronous cost.
5. Verify additivity: snapshot/compare the `additionalContext` for an unflagged/failing case against current output so nothing else shifts.
6. Test philosophy — write a few tests, mostly integration. Drive the builder with a flagged fixture (advisory present) and with a forced git-failure/budget-overrun (advisory absent, payload otherwise unchanged). Do not re-test the core's git internals.
</details>
