---
id: 6
group: "cleanup"
dependencies: [5]
status: "completed"
created: 2026-05-23
skills:
  - typescript
---
# Delete `BootstrapRunner`, `CuratorRunner`, `proper-lockfile`, and obsolete tests

## Objective
With the launchers in place (Task 5) and the skills driving the LLM in-host (Task 4), remove the now-dead sub-agent runner code, the `proper-lockfile` dependency, and the tests that exercised the deleted code paths. `grep -r runHeadless src/` must return zero matches afterward.

## Skills Required
- `typescript` — surgical removal of classes, call sites, and tests without breaking the surviving primitives and library exports.

## Acceptance Criteria
- [ ] `BootstrapRunner` class and its `runHeadless` method are removed from `src/lib/bootstrap.ts` (and any helper exports unique to it). Surviving primitives (`discoverMarkdownFiles`, etc.) are kept or moved as Tasks 1–3 required.
- [ ] `CuratorRunner` class and its `runHeadless` method are removed from `src/lib/curate.ts`. `dedupActions`, `markSessionsProcessed`, pending-session enumeration, and any other pure helpers stay (they are used by Task 3's `curate dedup`).
- [ ] `grep -r "runHeadless" src/` returns zero matches. `grep -r "BootstrapRunner\|CuratorRunner" src/` returns zero matches.
- [ ] `proper-lockfile` usage is removed from `src/lib/state.ts` and any other call site. The package is removed from `dependencies` in `package.json` (and `package-lock.json` is regenerated). `npm ls proper-lockfile` reports "(empty)" in the production tree.
- [ ] All tests that targeted the deleted runners are **removed** (not skipped). The test diff should make removals explicit.
- [ ] `KB_BUILDER_INTERNAL` env handling is retained at the launcher's spawn site (Task 5) but any in-runner consumers of the variable that referenced the now-deleted sub-agent flow are removed.
- [ ] The legacy fallback path inside the skills (added in Task 4) becomes dead: either it is removed in this task (preferred, since the new primitives are now mandatory) or a follow-up issue is filed. Pick one and note in the PR.
- [ ] Full test suite (`npm test`) passes after deletions.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Be careful when removing imports — leave `discoverMarkdownFiles`, `dedupActions`, `ensureUniqueId`, `markSessionsProcessed`, and pending-session enumeration intact and exported, since the primitives from Tasks 1–3 depend on them.
- After removing `proper-lockfile`, re-run any state-mutation tests to confirm the atomic tmp+rename writes are sufficient on their own.

## Input Dependencies
- Task 5 — launchers must already exist; deleting the runners while the CLI still imports them breaks the build.

## Output Artifacts
- A leaner library surface with one less dependency, no dead classes, and no sub-agent fan-out anywhere in the repo.

## Implementation Notes
<details>
<summary>Details</summary>

- Order of operations: (1) delete the CLI command call sites' final references to the runner classes if Task 5 missed any; (2) delete the classes; (3) delete the tests that targeted them; (4) `npm uninstall proper-lockfile`; (5) `npm test`; (6) iterate on any compile errors.
- The plan's success criterion #4 is "grep for runHeadless returns zero matches in src/". Make that the literal closing check before merging.
- The KB convention node `practice-recursion-guard-kb-builder-internal` is updated in Task 7 to reflect the narrower scope (`KB_BUILDER_INTERNAL` now only fires from the launcher).
- If `proper-lockfile` turns out to be a transitive dependency of a test tool, leave it as a dev / transitive dep. Only its presence in production `dependencies` is the success criterion (#6 in the plan).
- Per the plan: do **not** add a replacement lock. Single-author atomic tmp+rename is the deliberate target.

</details>
