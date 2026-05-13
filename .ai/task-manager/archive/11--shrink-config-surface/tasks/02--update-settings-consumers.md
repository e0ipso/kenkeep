---
id: 2
group: "settings-consumers"
dependencies: [1]
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Drop `warnings` loops and internal-setting reads across consumers

## Objective

Update every call site of `resolveSettings` so it no longer destructures `warnings` and no longer reads the five removed knobs (`drainBound`, `maxAttempts`, `proposalTimeout`, `lockTtlMs`, `bootstrapTokenBudget`). Move the internal defaults back into the libs that consume them.

## Skills Required

- `typescript`: refactor across `src/hooks/`, `src/commands/`, and a few `src/lib/` files; rely on TS strict mode to surface stragglers.

## Acceptance Criteria

- [ ] `rg -n "warnings" src/commands src/hooks` returns no hits referencing the `resolveSettings` result. (`commands/doctor.ts` keeps its local `warnings` counter — that is unrelated and stays.)
- [ ] `rg -n "drainBound|maxAttempts|proposalTimeout|lockTtlMs|bootstrapTokenBudget" src/commands src/hooks` returns zero hits.
- [ ] `src/hooks/kb-proposal-drain.ts` no longer passes `maxEntries`, `maxAttempts`, `timeoutMs`, or `lockTtlMs` derived from settings. The lib defaults in `src/lib/proposal-drain.ts` apply.
- [ ] `src/lib/proposal-drain.ts` defines local module-level constants for any default it currently expects callers to supply (`drainBound` → e.g. `DEFAULT_DRAIN_BOUND = 5`, `proposalTimeout` → `DEFAULT_TIMEOUT_MS = 60_000`, `lockTtlMs` → `DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000`). `DEFAULT_MAX_ATTEMPTS` already exists; keep it.
- [ ] `src/lib/curate.ts` keeps `lockTtlMs` working internally via a local default (`30 * 60 * 1000`); the `lockTtlMs?: number` option on `CurateContext` may stay (still used by tests) but is no longer populated from settings.
- [ ] `src/lib/bootstrap.ts` keeps `lockTtlMs` working internally via the same local default; the `lockTtlMs?: number` option on `BootstrapContext` may stay but is no longer populated from settings.
- [ ] `npm run build` succeeds (compile-only check via `tsc`). Test suite changes are deferred to task 5.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files touched: `src/hooks/kb-proposal-drain.ts`, `src/commands/curate.ts`, `src/commands/bootstrap-incremental.ts`, `src/commands/index-rebuild.ts`, `src/commands/logs-prune.ts`, `src/lib/proposal-drain.ts`, `src/lib/curate.ts`, `src/lib/bootstrap.ts`.
- This task does NOT delete the `tokenBudget` plumbing in `bootstrap.ts` / `curate.ts` libs and CLI — that is task 3's scope. It only removes the *settings → tokenBudget* wiring (i.e., stop reading `settings.bootstrapTokenBudget` in `commands/bootstrap-incremental.ts`).

## Input Dependencies

Task 1 (schema + `resolveSettings` shape).

## Output Artifacts

All consumer files compile against the new `resolveSettings` return shape. Internal defaults live in the libs that need them.

## Implementation Notes

<details>
<summary>Per-file edits</summary>

**`src/hooks/kb-proposal-drain.ts`** (lines 52-62):

Before:
```ts
const { settings } = resolveSettings({ projectFile: paths.projectConfigFile });
...
maxEntries: settings.drainBound,
maxAttempts: settings.maxAttempts,
timeoutMs: settings.proposalTimeout,
lockTtlMs: settings.lockTtlMs,
```

After: keep the `resolveSettings` call (the hook may still read `proposalModel`/`curatorModel` — check the surrounding code). Drop the four lines above so the lib defaults apply. If the only remaining use of `settings` is for model selection, leave that read in place.

**`src/lib/proposal-drain.ts`**: define `const DEFAULT_DRAIN_BOUND = 5;`, `const DEFAULT_TIMEOUT_MS = 60_000;`, `const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;` near the existing `DEFAULT_MAX_ATTEMPTS`. The current `ctx.lockTtlMs ?? <something>` style should fall through to these defaults. If `maxEntries`/`timeoutMs` are currently always-supplied, give them `??` defaults at the read site.

**`src/commands/curate.ts`** (lines 46-47): drop `warnings` from destructure and drop the `for (const w of warnings) log.warn(w);` line. Anywhere in this file that reads `settings.lockTtlMs` or `settings.maxAttempts`, delete the read.

**`src/commands/bootstrap-incremental.ts`** (lines 50-73): drop `warnings` destructure + warn loop. Delete the `tokenBudget: settings.bootstrapTokenBudget` and any `lockTtlMs: settings.lockTtlMs` lines. Keep the CLI `opts.tokenBudget` plumbing on `ctx.tokenBudget` for now — task 3 will remove it together with the lib option.

**`src/commands/index-rebuild.ts`** (lines 41-42): drop `warnings` destructure + warn loop. If `resolveSettings` result is no longer used at all, change the call to a side-effecting validation: `resolveSettings({ projectFile: paths.projectConfigFile });` to keep the strict-schema check, or remove entirely if not needed for validation. Pick the version that keeps current behavior closest (validation on a malformed config is desirable here).

**`src/commands/logs-prune.ts`**: drop `warnings` destructure + warn loop only; further simplification of this file is task 4's scope.

**`src/lib/curate.ts` and `src/lib/bootstrap.ts`**: where they currently use `ctx.lockTtlMs ?? <hard-coded>`, ensure the hard-coded fallback is `30 * 60 * 1000`. No need to remove the `lockTtlMs?: number` ctx field in this task — task 3 will rewrite these files anyway when removing token budgeting.

Compile check: `npm run build`. Tests are intentionally red after this task; task 5 fixes them.

</details>
