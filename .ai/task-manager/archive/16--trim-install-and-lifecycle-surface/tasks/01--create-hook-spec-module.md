---
id: 1
group: "hook-spec"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Create centralized hook-spec module

## Objective

Introduce `src/lib/hook-spec.ts` as the single source of truth for the registered Claude Code hooks (event, script path, async flag) so that `init.ts`, `doctor.ts`, and the upgrade path stop carrying three parallel hook lists.

## Skills Required

- `typescript`: define a typed exported array consumed by both the hook registration writer (`writeClaudeHookConfig`) and the doctor verifier.

## Acceptance Criteria

- [ ] `src/lib/hook-spec.ts` exists and exports one typed array of hook registrations.
- [ ] Each entry carries the event name, script path (relative to `.claude/hooks/`), and async flag.
- [ ] Shape supports both consumers: registration writer (needs `scriptPath` + `async`) and doctor verifier (needs entry-in-settings + file-on-disk check).
- [ ] The module is self-contained: no imports from `init.ts` or `doctor.ts`.
- [ ] `npm run build` passes; the new module compiles cleanly.

## Technical Requirements

- TypeScript module under `src/lib/`.
- Export the array plus any small helper type/interface needed.
- Entries to cover: `kb-capture`, `kb-lint-tick`, `kb-proposal-drain`, `kb-session-start` (verify exact set against the inline list in `installClaude` at `src/commands/init.ts:442-453` and `EXPECTED_HOOK_COMMANDS` at `src/commands/init.ts:340-353` and `EXPECTED_HOOK_SCRIPTS` at `src/commands/doctor.ts:326-331`).

## Input Dependencies

None.

## Output Artifacts

- `src/lib/hook-spec.ts` with exported typed array.
- Type/interface for the hook entry shape (named e.g. `HookSpec`).

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. Open `src/commands/init.ts` and read the inline hook list inside `installClaude` (around init.ts:442-453) plus `EXPECTED_HOOK_COMMANDS` (init.ts:340-353).
2. Open `src/commands/doctor.ts` and read `EXPECTED_HOOK_SCRIPTS` (doctor.ts:326-331). Confirm the union of fields each consumer needs: event name, script file name under `.claude/hooks/`, async flag.
3. Create `src/lib/hook-spec.ts`:
   - Export a `HookSpec` type (or interface) with fields `event` (string literal union over the supported events), `scriptPath` (relative path string under `.claude/hooks/`), and `async` (boolean).
   - Export `HOOK_SPECS: readonly HookSpec[]` containing the four entries.
   - Order entries identically to the existing `installClaude` list to minimize diff churn when downstream tasks consume it.
4. Do not yet modify `init.ts` or `doctor.ts`; downstream tasks (Task 2, 3, 5) wire this module in.
5. Run `npm run build` to confirm the module compiles. No test required at this step; the module's correctness is exercised when consumers wire it in.

</details>
