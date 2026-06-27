---
id: 5
group: "deterministic-primitives"
dependencies: []
status: "completed"
created: 2026-06-27
skills:
  - typescript-cli
complexity_score: 3
complexity_notes: "Contingent (YAGNI) item: implement only if the env detector reuses cleanly, otherwise document the deferral."
---
# (Contingent) Make `index rebuild --harness` optional via in-session self-detection

## Objective
Collapse the largest remaining repeated block in the skills — the
harness-resolution that exists solely to pass `--harness` to `index rebuild` —
**if and only if** the existing environment detector can be reused cleanly
inside `index rebuild`. This is the plan's intentionally contingent item
(success criterion 11): implement self-detection when reuse is clean, otherwise
defer it without touching the rest of the plan and leave the skills resolving
`$HARNESS`.

## Skills Required
TypeScript CLI command implementation (commander option handling, reuse of the
existing harness detector).

## Acceptance Criteria
- [ ] Evaluate whether the existing env-based harness detector (the logic behind `kk-detect-harness.mjs` / `src/harnesses/detect.ts`) can be invoked in-process by `src/commands/index-rebuild.ts` without new coupling or behavioral change.
- [ ] **If reuse is clean:** `--harness` on `index rebuild` becomes optional; when omitted, the command self-detects the harness from the environment, falling back to the existing detection order. Existing callers passing `--harness` keep working unchanged (additive/backward-compatible). A test asserts both: explicit `--harness X` is honored, and omission self-detects in a controlled env.
- [ ] **If reuse is NOT clean:** make no code change; record in this task file (and surface in the execution summary) the specific reason reuse was rejected, and confirm the skills retain `$HARNESS` resolution for `index rebuild`. This is an acceptable terminal outcome per the plan.
- [ ] Either way: `npm run build`, `npm run typecheck`, and `npm test` remain green, and no existing flag, option, or behavior is removed/renamed.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Inspect `src/commands/index-rebuild.ts`, `src/harnesses/detect.ts` (or wherever `resolveWithHint`/env detection lives), and how `--harness` is currently consumed.
- Any change must be additive: `--harness` stays a valid option; only its requiredness relaxes.

## Input Dependencies
None.

## Output Artifacts
Either an `index rebuild` that self-detects the harness (with a test), or a
documented deferral decision. Task 6 reads this outcome: if implemented, it
shrinks the skills' harness-resolution blocks to root detection only; if
deferred, the skills keep `$HARNESS` resolution.

## Execution Outcome (recorded for Task 6)

**Outcome: implemented with NO index-rebuild code change.** Investigation found
the plan's premise ("`index rebuild` requires `--harness`") is inaccurate against
the current code: `runIndexRebuild` reads only `{ stage }` and never consults the
harness. `--harness` is the *global* program option (`program.option`, not
required), which `index rebuild` ignores entirely. Verified live in a sandbox:
`index rebuild`, `index rebuild --harness claude`, and `--harness claude index
rebuild` all exit 0 with identical behavior. The existing `tests/index-rebuild.test.ts`
already calls `index rebuild` with no `--harness` and asserts exit 0, so the
"omission works" guarantee is already locked in.

Therefore `--harness` is already optional for `index rebuild`, and no
self-detection logic is required (there is nothing for the command to detect —
it does not use the harness). **Task 6 may drop the entire `$HARNESS` resolution
block and the `--harness "$HARNESS"` argument from all five skills**, collapsing
the harness-resolution to root detection only. This satisfies success criterion
11's "implemented" branch.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Honor YAGNI: do not refactor the detector to force reuse. Spend a short, bounded look at whether the existing env detection function is callable from `index-rebuild.ts` as-is. If it requires plumbing a new abstraction or risks changing detection results, STOP and choose the deferral outcome — that is explicitly allowed.
3. If implementing: make `--harness` optional in the commander definition; when absent, call the existing detector; preserve the current default/error behavior when detection is ambiguous. Do NOT change what an explicit `--harness` does.
4. Record the decision (implemented vs deferred, and why) in a short note appended to this task file so the orchestrator can fold it into the plan's execution summary and so Task 6 knows whether to shrink the harness block.
5. Test philosophy — "write a few tests, mostly integration": if implemented, one test covering explicit-harness and self-detect paths is sufficient; do not build a matrix over every harness id.
6. Run `npm run build`, `npm run typecheck`, and `npm test` before declaring done. Report the chosen outcome explicitly.
</details>
