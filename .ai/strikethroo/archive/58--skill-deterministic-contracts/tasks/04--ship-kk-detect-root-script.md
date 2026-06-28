---
id: 4
group: "packaging"
dependencies: []
status: "completed"
created: 2026-06-27
skills:
  - typescript-cli
  - vitest
complexity_score: 4
complexity_notes: "Ships a new skeleton script and proves copy-if-missing delivery on upgrade without overwrite; small but packaging-sensitive."
---
# Ship `kk-detect-root.mjs` from the package skeleton with copy-if-missing delivery

## Objective
Replace the 33-line `kk-detect-root` heredoc inlined in five skills with a
single shipped script, mirroring the already-shipped
`src/templates-source/kenkeep/scripts/kk-detect-harness.mjs`. Add
`kk-detect-root.mjs` to the skeleton so first-time `init` lands it and existing
installs receive it via the `ensureKkScripts` copy-if-missing upgrade path
(never overwriting a user-edited copy). This task ships the script and proves
its delivery; Task 6 switches the skills to reference it.

## Skills Required
Node ESM script authoring and TypeScript/Vitest test design for the
init/upgrade path.

## Acceptance Criteria
- [ ] `src/templates-source/kenkeep/scripts/kk-detect-root.mjs` exists, resolves the project root by walking up from `cwd` to the first directory containing `.ai/kenkeep`, prints that absolute path on stdout and exits 0, and exits non-zero with a clear stderr message when no `.ai/kenkeep` is found — i.e. behaviorally identical to the current heredoc body.
- [ ] First-time `init` lands the script (it is part of the `templates/kenkeep` skeleton copied wholesale by `init`); confirm via the init flow / existing init tests.
- [ ] `ensureKkScripts` delivers it to an existing install on `init --upgrade`: a fixture lacking `.ai/kenkeep/scripts/kk-detect-root.mjs` gains it after upgrade, and an install with a user-modified copy is left untouched (copy-if-missing, no overwrite). Verify `ensureKkScripts` in `src/commands/init.ts` requires no change (it copies every file in the scripts dir generically) — if it needs a change, keep it additive.
- [ ] A test asserts both: (a) upgrade copies the script when missing, and (b) upgrade does NOT overwrite an existing (sentinel-modified) copy.
- [ ] `node dist/cli.js init --help` still works and `npm run build`, `npm run typecheck`, and the new/affected tests pass.
- [ ] The invocation form the skills will use is decided and documented here so Task 6 can apply it consistently (see Implementation Notes — resolve the bootstrap wrinkle: the script lives under `.ai/kenkeep/scripts/` but the skill must find the root before it can reference that path).

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- New: `src/templates-source/kenkeep/scripts/kk-detect-root.mjs` (ESM, Node 22+), header comment matching the `kk-detect-harness.mjs` style.
- Delivery: `ensureKkScripts(...)` in `src/commands/init.ts` (already wired for the scripts dir; confirm generic copy covers the new file).
- Tests: extend the existing init/upgrade test coverage (find the test that exercises `ensureKkScripts` / `kk-detect-harness.mjs` delivery and add the root-script cases alongside).
- Do NOT hand-edit anything under generated `templates/`; the build mirrors source (Task 7 runs the build).

## Input Dependencies
None.

## Output Artifacts
The shipped `kk-detect-root.mjs` skeleton script and its delivery test. Consumed
by Task 6 (skills reference it) and Task 7 (template build/mirror).

## Execution Outcome (recorded for Task 6)

**Decision: ship `kk-detect-root.mjs`; skills invoke it directly as
`KK_REPO_ROOT=$(node .ai/kenkeep/scripts/kk-detect-root.mjs)`** (mirroring how
`kk-detect-harness.mjs` is already invoked), then `cd "$KK_REPO_ROOT"`. No new
`resolve-root` CLI primitive was added — that avoids dead/duplicate surface, and
the direct invocation matches the existing harness-detector pattern. The script
walks up from cwd, so it prints the root whenever cwd is at or under it.

`ensureKkScripts` required **no change** — it copies every file in
`templates/kenkeep/scripts/` that is missing, so the new script ships on first
`init` and is delivered copy-if-missing on `init --upgrade` without overwriting a
user copy (both proven by `tests/upgrade.test.ts`).

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Copy the heredoc body verbatim from any skill (e.g. `src/templates-source/skills/kk-add/SKILL.md`, the block between `cat << 'EOF' > /tmp/kk-detect-root.mjs` and `EOF`) into `kk-detect-root.mjs`. Add a header comment in the `kk-detect-harness.mjs` style.
3. Read `src/commands/init.ts` `ensureKkScripts` — it iterates `readdirSync(src)` and copies any name missing in `dst`, skipping existing files. So dropping the new file into `src/templates-source/kenkeep/scripts/` makes it ship and upgrade automatically; likely NO code change is needed. Confirm by test, do not assume.
4. **Bootstrap wrinkle (decide and document):** the shipped `kk-detect-harness.mjs` is invoked as `node .ai/kenkeep/scripts/kk-detect-harness.mjs` only AFTER the root is known. `kk-detect-root` is what establishes the root, so it cannot rely on already being at the root. Pick the cleanest option and write it into this task's record for Task 6:
   - Option A: add a tiny `kenkeep resolve-root` CLI primitive (the `kenkeep` binary is already on PATH for skills) that runs the same walk-up — one line in skills: `KK_REPO_ROOT=$(npx kenkeep resolve-root)`.
   - Option B: keep a minimal inline bootstrap that locates `.ai/kenkeep/scripts/kk-detect-root.mjs` by walking up, then delegates — barely shorter than today, so prefer A.
   Recommend Option A unless it complicates the CLI; if you add `resolve-root`, treat it as additive and note it for Task 7's CHANGELOG. Keep the shipped `.mjs` regardless (it is the documented, dependency-free fallback mirroring `kk-detect-harness.mjs`).
5. Test philosophy — "write a few tests, mostly integration": exercise the real init/upgrade flow against a temp fixture; assert file presence after upgrade and non-overwrite of a sentinel-modified copy. Reuse the existing init test fixtures/helpers; do not write a bespoke harness.
6. Run `npm run build`, `npm run typecheck`, and the affected tests before declaring done. Report exactly which files changed and which invocation option you chose.
</details>
