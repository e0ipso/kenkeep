---
id: 1
group: "per-harness-status"
dependencies: []
status: "completed"
created: 2026-07-07
skills:
  - typescript
---
# Per-Harness Install-Status View in doctor

## Objective
Add a compact, grouped per-harness install-status block to `doctor` so that,
for each *installed* harness (respecting `--harness <id>` scoping), the command
answers "is this harness correctly installed here?" at a glance. The block
reports: hooks present/absent with the expected path, skills present/absent,
detection status (fires / would-not-fire / no-detector-n/a), and kk-hooks vs
hooks placement correctness. All read-only, warn/info only — never an error
unless the underlying per-adapter check is already an error today.

## Skills Required
- **typescript**: Node ≥22 ESM with `.js` import extensions; edit
  `src/commands/doctor.ts`, reusing harness registry, adapter `paths()`,
  shared-hooks helpers, and the detection predicates.

## Acceptance Criteria
- [ ] `doctor` emits one grouped block per installed harness, iterating the same
      `scoped`/`installedHarnessIds()` set already used in `runDoctor` (honors
      `--harness <id>` and only reports installed harnesses).
- [ ] Each block shows: hooks present/absent with the expected script path,
      skills present/absent, a detection-status line, and a kk-hooks/hooks
      placement line.
- [ ] Detection status renders "no detector / n/a" for `codex`, `copilot`,
      `opencode` and a truthful fires/would-not-fire value for `claude`/`cursor`,
      read via the existing `detectFromEnv`/`detectHarnessFromEnv` predicates
      without modifying detection logic.
- [ ] Output uses `src/lib/log.ts` grouped lines (picocolors `✓ ! ✗`); no
      hand-rolled ASCII table; line payloads are stable, substring-assertable text.
- [ ] Informational/OK items never raise exit code; genuinely-missing installed
      pieces use warn level, never error (unless already error today).
- [ ] **Verification:** `npm run build && npm run typecheck && npm run lint` all
      exit 0 (the last includes `scripts/lint-detect-harness.mjs`). Then, in a
      sandbox with harnesses installed, `node dist/cli.js doctor -v` prints a
      grouped block per installed harness, and
      `node dist/cli.js doctor --harness copilot` renders only copilot's block
      with its kk-hooks placement reported.

## Technical Requirements
- File: `src/commands/doctor.ts` (`runDoctor`).
- Reuse: `installedHarnessIds()` + the `scoped` list already computed at
  `doctor.ts:66-67`; harness registry `getHarness`/`hasHarness`; each
  `adapter.paths(root)` (`HarnessPaths` incl. `hooksDir`, `skillsDir`,
  optional `kkHooksDir`/`pluginsDir`/`settingsFile`); `adapter.hooks`
  (`HookSpec[]`).
- Shared-hooks helpers in `src/lib/shared-hooks.ts`:
  `sharedHookScriptPath(harnessId, scriptPath)`,
  `sharedHarnessHooksDirForRoot(root, harnessId)`.
- Detection: `src/harnesses/detect.ts` `detectHarnessFromEnv(env)` and/or
  `adapter.detectFromEnv?.(env)` — **read only**, do not restructure
  `detect.ts` or the shipped `.mjs` (the drift guard fails on any divergence).
- Reference implementation to mirror for "hooks present/absent with expected
  path": `src/harnesses/claude/doctor.ts` `checkClaudeHooks`, which computes
  `sharedHookScriptPath('claude', spec.scriptPath)` and distinguishes
  missing-registration from missing-script-file.
- Log symbols/levels: `src/lib/log.ts` (`log.success`/`log.warn`/`log.info`/
  `log.plain`).

## Input Dependencies
None. This task is independent and lives entirely in `doctor.ts` +
read-only reuse of existing harness/shared-hooks/detection helpers.

## Output Artifacts
- A per-harness grouped status block rendered by `runDoctor`, consumed by the
  tests in task 4 and described by the docs in task 5. Task 3 (doctor surfacing
  of hygiene findings) edits the same `runDoctor` rendering area and depends on
  this task landing first.

## Implementation Notes
Prefer re-presenting status each adapter already computes over adding a method
to the `HarnessAdapter` interface. Adding an interface method is **out of
preference** (it would touch `src/harnesses/types.ts` + all five adapters); if
re-deriving per-harness registration truthfully proves infeasible without one,
STOP and surface it as an explicit flagged decision rather than silently
generalizing and reporting wrong status.

<details>
<summary>Step-by-step implementation</summary>

1. In `runDoctor` (`src/commands/doctor.ts`), after the existing `harnessChecks`
   loop (around line 68-74), build a rendering routine that, for each `id` in
   the same `scoped` set (guarded by `hasHarness(id)` and, when `opts.harness`
   is set, `installed.includes(id)` — mirror the existing filters), emits a
   grouped block. Do NOT re-iterate a different set; reuse `scoped`.
2. Print a block header line per harness (e.g. `log.info` with a stable label
   such as `Harness ${id}` — pick a substring-stable label the tests can match).
3. **Hooks line(s):** for each `spec` in `adapter.hooks`, compute the expected
   path via `sharedHookScriptPath(id, spec.scriptPath)` and check
   `existsSync(join(adapter.paths(root).hooksDir ?? sharedHarnessHooksDirForRoot(root, id), spec.scriptPath))`.
   Emit present (`log.success`) with the expected path, or absent (`log.warn`)
   naming the missing script and its expected path. Mirror the logic in
   `checkClaudeHooks` but do NOT duplicate its wording — keep it generic.
4. **Skills line:** check `adapter.paths(root).skillsDir` exists and (optionally)
   that expected skills are present; `EXPECTED_SKILLS` lives in
   `src/lib/install-skills.ts`. Emit present/absent as success/warn.
5. **Detection line:** if `adapter.detectFromEnv` is undefined, render
   `detection: no detector (n/a)` at info level. If defined, call
   `adapter.detectFromEnv(process.env)` and render `detection: would fire` /
   `detection: would not fire here` at info level. NEVER warn/error on
   detection — three of five harnesses legitimately have no detector and a
   plain shell reports false for all.
6. **kk-hooks/hooks placement line:** confirm scripts landed at the normalized
   destination `sharedHarnessHooksDirForRoot(root, id)` (all harnesses normalize
   to `.ai/kenkeep/hooks/<harness>/`). copilot/opencode ship template scripts
   under a `kk-hooks` template dir but still normalize at the destination; if the
   adapter's `paths()` exposes an extra `kkHooksDir`, reflect that placement
   expectation. Emit success when placement is correct, warn otherwise.
7. Keep all payload text plain (no width math); place color only around
   symbols/labels via the `log` helpers, so substring assertions and no
   `strip-ansi` dependency are needed.
8. Do not change exit-code accounting: these are info/warn lines. If you route
   any of them through the existing `checks`/`failures`/`warnings` tally, ensure
   info lines don't increment counters and warns follow the existing
   warnings-still-exit-0 path.
9. Build (`npm run build`) before exercising `dist/cli.js`; run `npm run
   typecheck` and `npm run lint` and confirm all pass.
</details>
