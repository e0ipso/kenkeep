---
id: 2
group: "index-catalog-rewrite"
dependencies: [1]
status: "pending"
created: 2026-05-13
skills:
  - typescript
---
# Remove indexBudgetTokens / --budget-tokens from settings, CLI, and commands

## Objective

Eliminate the budget-knob surface from every user-facing and command-layer entry point. Drop `indexBudgetTokens` from the settings schema, defaults, and loader. Remove `--budget-tokens` from the CLI. Strip the field from `index-rebuild`, `curate` command wiring, and `CurateContext`. Update the `index rebuild` success summary to reflect the catalog model.

## Skills Required

- **typescript**: editing typed surfaces (Zod schemas, Commander CLI definitions, command option types, internal context types).

## Acceptance Criteria

- [ ] `SettingsSchema` in `src/lib/schemas.ts` no longer declares `indexBudgetTokens`.
- [ ] `src/lib/settings.ts`: `SETTINGS_DEFAULTS` (around line 17) no longer contains `indexBudgetTokens`; the merge in `loadSettings` (around line 141) no longer references it.
- [ ] `src/cli.ts`: the `--budget-tokens` option on `index rebuild` (lines ~183–186) is removed.
- [ ] `src/commands/index-rebuild.ts`: `budgetTokens` is removed from the options type and from the `genOpts` forwarded to `generateIndex`. The user-visible summary reads `INDEX.md regenerated (N nodes, ~T estimated tokens)`. The "hidden by token budget" branch is deleted.
- [ ] `src/commands/curate.ts`: `indexBudgetTokens` is no longer included in the context object passed to `runCurate` (around line 65).
- [ ] `src/lib/curate.ts`: `indexBudgetTokens` is removed from the `CurateContext` type (around line 62) and from the override block (around lines 540–541).
- [ ] `npm run typecheck` passes with zero errors after these edits combined with task 1's changes.
- [ ] No deprecation alias, no fallback path, no warning shim.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `src/lib/schemas.ts`, `src/lib/settings.ts`, `src/cli.ts`, `src/commands/index-rebuild.ts`, `src/commands/curate.ts`, `src/lib/curate.ts`.
- Commander.js (CLI) and Zod (schemas) familiarity.
- The success-summary string is plain `console.log` output; match the existing log helper used elsewhere in the file.

## Input Dependencies

- Task 1: the new `GeneratedIndex` shape (`{ content, nodesHash, nodeCount, estimatedTokens }`) drives the new success-summary string and the dropped `hiddenByBudget` branch.

## Output Artifacts

- A clean compile path with `indexBudgetTokens` / `--budget-tokens` / `budgetTokens` references fully removed.
- Updated `index rebuild` console output.

## Implementation Notes

<details>
<summary>Step-by-step implementation guide</summary>

1. `src/lib/schemas.ts`: locate `SettingsSchema`. Delete the `indexBudgetTokens` property (including any `.default(...)`).
2. `src/lib/settings.ts`:
   - Line ~17 (`SETTINGS_DEFAULTS`): remove the `indexBudgetTokens` entry.
   - Line ~141 (`loadSettings`): remove the corresponding key from the merge.
   - If `indexBudgetTokens` is referenced in helper types or exported constants in this file, delete those too.
3. `src/cli.ts`:
   - Find the `index rebuild` subcommand definition (~lines 183–186).
   - Remove the `.option('--budget-tokens <n>', ...)` line and any associated `parseInt` coercion.
   - The action handler no longer needs to forward `opts.budgetTokens`.
4. `src/commands/index-rebuild.ts`:
   - Drop `budgetTokens` from the options interface/type.
   - Drop `budgetTokens` from the object passed to `generateIndex` (`genOpts`).
   - Replace the success-summary string with `INDEX.md regenerated (${nodeCount} nodes, ~${estimatedTokens} estimated tokens)` using the new fields returned from `generateIndex`.
   - Delete any conditional branch that referenced `hiddenByBudget`.
5. `src/commands/curate.ts`:
   - Around line 65, the context object passed to `runCurate` no longer carries `indexBudgetTokens`. Remove that property.
6. `src/lib/curate.ts`:
   - Around line 62 in the `CurateContext` type, remove the `indexBudgetTokens` field.
   - Around lines 540–541 (the override block), remove the `indexBudgetTokens` override.
7. Run `npm run typecheck`. The only acceptable remaining type errors at this point are inside `tests/` (test updates land in task 3). If you see errors elsewhere in `src/`, address them — they indicate a missed call site.
8. Do not write any backwards-compatibility shim. Do not warn the user about the removed flag.

</details>

<details>
<summary>Out of scope for this task</summary>

- The generator rewrite itself (handled in task 1).
- Tests (handled in task 3).
- Docs and KB-node updates (handled in task 4).

</details>
