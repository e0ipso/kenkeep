---
id: 4
group: "docs"
dependencies: [1, 2, 3]
status: "pending"
created: 2026-06-21
skills:
  - technical-writing
  - build-tooling
---
# Update human-facing docs and propagate templates from source

## Objective
Make user-facing documentation consistent with the new `curate-persist`
primitive and the tightened rebalance trigger, and regenerate the bundled
`templates/` from `src/templates-source/` so installed skills match source. No
hand-editing of generated `templates/`.

## Skills Required
Technical writing (docs under `docs/`) and build tooling (running the template
build and validating no drift).

## Acceptance Criteria
- [ ] Docs under `docs/` that describe curation, rebalance, or troubleshooting reflect: the `curate-persist` batch primitive, the EBUSY/session-discovery/harness fallbacks, and the no-merge-for-folders-with-children + grouped `create-branch` trigger behavior.
- [ ] `npm run build` regenerates `templates/` from source with NO drift errors (generated output matches source).
- [ ] Generated skill templates reflect the source-skill edits from task 3.
- [ ] No generated file under `templates/` was hand-edited.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Identify the relevant docs pages (curation, how-it-works/internals, troubleshooting, internals prompts/architecture describing the curation+rebalance flow) and update only where they describe behavior changed by this plan.
- Run the repository build / template build pipeline; rely on its drift validation.

## Input Dependencies
Tasks 1, 2, 3 — the command, trigger, and source-skill behavior they finalize
are what the docs and generated templates must reflect.

## Output Artifacts
Updated `docs/` pages and regenerated `templates/`. Consumed by task 05 (final
validation re-runs build + drift checks).

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. Grep `docs/` for curation/rebalance/curate-persist/troubleshooting references; update only the pages whose described behavior changed under this plan.
2. Run `npm run build` and confirm it completes with no template-drift error. If the build reports drift, the fix is to correct the SOURCE (`src/templates-source/`), then rebuild — never edit `templates/` by hand.
3. Keep doc edits scoped to behavior this plan changes; do not rewrite unrelated docs.
4. Report exactly which files you changed (docs + any regenerated templates).
</details>
