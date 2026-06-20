---
id: 6
group: "session-knowledge-extraction"
dependencies: []
status: "completed"
created: 2026-06-20
skills:
  - typescript
  - cli-primitives
complexity_score: 6
complexity_notes: "Adds an opt-in session filter to the shared curate-dedup primitive while preserving the default all-done-log behavior used by /kk-curate."
---
# Scope live curation stamping to the staged session

## Objective
Add a narrow `curate-dedup` option that lets `/kk-session-extract` stamp only the staged live session log, so current-session extraction cannot accidentally mark unrelated `proposal_status: done` logs as processed.

## Skills Required
- `typescript` - update curate session discovery and command option handling without changing the ordinary `/kk-curate` path.
- `cli-primitives` - keep the new option deterministic, validated, and covered by command tests.

## Acceptance Criteria
- [ ] `curate-dedup` supports an opt-in filter, such as `--session-id <uuid-v4>`, that restricts session stamping to the matching unprocessed done log.
- [ ] The default `curate-dedup` behavior remains unchanged: without the filter, it stamps every unprocessed `proposal_status: done` log in `_sessions/`.
- [ ] When the filter is supplied and the matching log is missing, already processed, or not `proposal_status: done`, the command fails clearly before writing survivors, conflicts, or stamps.
- [ ] The filter validates the supplied id with the same UUID-v4 boundary used by hook code; do not accept arbitrary non-UUID ids.
- [ ] `candidate_origin` remains provenance only. It is not used to decide which session logs are stamped.
- [ ] Tests cover default all-log stamping, filtered single-log stamping, missing/not-done filtered-log failure with no writes, and validation failure for non-UUID ids.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files likely involved: `src/commands/curate-dedup.ts`, `src/lib/curate.ts`, `src/lib/session-log.ts`, and `tests/commands/curate-dedup.test.ts`.
- Reuse `listPendingSessions` or factor a small helper so ordering and validation stay consistent with the existing curation path.
- Preserve current conflict-file and survivors-output determinism. If the filtered target is invalid, fail before any filesystem writes.
- Keep this as an additive primitive option. Do not add locks, background workers, or a second curation command.

## Input Dependencies
None. This can be developed in parallel with Task 1 and Task 2, but Task 3 must use its final option name.

## Output Artifacts
- A `curate-dedup` session-stamping filter usable by `/kk-session-extract`.
- Regression tests proving unrelated done logs remain unstamped during live extraction.
- Updated command help/description for the new option.

## Implementation Notes
Source inspection shows `runCurateDedupCommand` currently calls `listPendingSessions(sessionsDir)` and stamps every returned log. That behavior is correct for `/kk-curate` and must remain the default; the live extraction path needs an explicit narrower mode.

<details>
<summary>Detailed implementation guidance</summary>

1. Add an optional command flag and internal option, for example `sessionId?: string`.
2. Validate the supplied id with `assertValidSessionId` before parsing or writing output.
3. Build the pending-session list exactly as today, then filter by `sessionId` only when the flag is present.
4. If the flag is present and the filtered list is empty, return a non-zero exit code before writing survivors or conflicts. This prevents a live run from persisting nodes while leaving the staged log unstamped.
5. Leave `candidate_origin` untouched. It should still use `<session_id>:<practice|map>:<index>` for node provenance, but stamping selection must come from the explicit command option.
6. Add tests with two done logs and one filtered session id. Assert only the filtered log receives `curator_processed_at` / `curator_run_id`, and the other log remains available for a later `/kk-curate`.

</details>
