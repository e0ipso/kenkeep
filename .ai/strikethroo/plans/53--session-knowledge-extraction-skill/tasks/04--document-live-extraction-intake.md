---
id: 4
group: "session-knowledge-extraction"
dependencies: [1, 2, 3, 6]
status: "completed"
created: 2026-06-20
skills:
  - documentation
  - product-docs
complexity_score: 6
complexity_notes: "Touches human-facing docs, AI-facing package docs, PRD/product lists, and internals docs to explain a new intake path, scoped dedup stamping, idempotency caveats, and existing curation concurrency semantics consistently."
---
# Document the live extraction intake path

## Objective
Update product, daily-use, and internals documentation so users and future agents understand the three knowledge intake paths and the idempotency behavior of live session extraction.

## Skills Required
- `documentation` - update user-facing workflow docs with concise, accurate guidance.
- `product-docs` - keep PRD and internals descriptions aligned with the implemented CLI primitive and capture preservation rule.

## Acceptance Criteria
- [ ] Docs distinguish `/kk-add` as user-dictated single-node capture, `/kk-session-extract` as live single-session extraction, and `/kk-curate` as deferred batched curation.
- [ ] Docs describe that `/kk-session-extract` uses `proposal-extract.md` unchanged, emits the strict current proposal schema, and may correctly find no durable knowledge.
- [ ] Internals docs cover `session-log stage-live`, the staged `proposal_status: done` contract, targeted `curate-dedup` stamping for the staged `session_id`, and capture preservation of `curator_processed_at` / `curator_run_id`.
- [ ] Degraded idempotency is documented for runtimes where the live session id cannot be matched to a later UUID-v4 capture.
- [ ] `PRD.md` and generated-template source docs are updated where the product surface, deterministic primitive list, or installed skill list changes.
- [ ] Any stale PRD/docs language claiming `kk-curate` uses a cross-process curation lock is corrected to the current single-author/no-lock behavior; do not add a lock.
- [ ] Prompt/schema version notes are accurate: no `proposal-extract.md` change is required, no schema bump is expected, and any edited skill template carries the correct Version comment.
- [ ] No generated `templates/` file is hand-edited; generated docs/templates are produced from source when needed.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files likely involved: `PRD.md`, `docs/daily-use.md`, `docs/how-it-works.md`, `docs/installation.md`, `docs/internals/architecture.md`, `docs/internals/prompts.md` or `docs/internals/schemas.md`, and `src/templates-source/kenkeep/README.md`.
- Keep the documentation aligned with the actual command names and options chosen in Tasks 1 and 3.
- Add knowledge-base nodes only through normal curation/review; do not hand-edit `.ai/kenkeep/nodes/` as part of this task.

## Input Dependencies
- Task 1: final staging primitive name and output contract.
- Task 2: final capture preservation field behavior.
- Task 3: final skill name, install surface, and workflow instructions.
- Task 6: final scoped `curate-dedup` option name and behavior.

## Output Artifacts
- Updated user and internals documentation.
- Updated packaged README/source docs if the installed project skeleton references available skills.

## Implementation Notes
The docs should prevent misuse: `/kk-session-extract` is not a way to dictate a node, and it is not a replacement for periodic `/kk-curate` over captured logs.

<details>
<summary>Detailed implementation guidance</summary>

1. Search for existing lists of `kk-add`, `kk-bootstrap`, `kk-curate`, and `kk-migrate`; update only lists where an end user or installed skeleton should see `/kk-session-extract`.
2. In daily-use docs, present the path selection plainly:
   - use `/kk-add` when the user already knows the node;
   - use `/kk-session-extract` when the current session just produced durable project knowledge;
   - use `/kk-curate` when processing accumulated captured logs.
3. In internals docs, focus on the session-log boundary: staged live proposals become a normal done log, `curate-dedup` stamps only that staged log when called from `/kk-session-extract`, and later capture preserves the processed stamp.
4. In PRD updates, keep the additive nature clear. Existing `kk-add`, `kk-curate`, capture, and proposal drain behavior should remain unchanged except for processed-stamp preservation and the opt-in dedup session filter.
5. Mention partial context after compaction and the UUID/fallback idempotency caveat without over-explaining harness internals.
6. Check existing docs against source before copying them: current code uses `.ai/kenkeep/_sessions/`, the proposal schema has no legacy join hints, and curation is single-author without a cross-process lock.

</details>
