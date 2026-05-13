---
id: 1
group: "settings-core"
dependencies: []
status: "completed"
created: 2026-05-13
skills:
  - typescript
---
# Reduce `SettingsSchema` and rewrite `resolveSettings`

## Objective

Shrink the on-disk settings surface to user-facing knobs only. Remove the user-level config layer and the `warnings` array threaded through `resolveSettings`. The strict schema must reject any removed key loudly.

## Skills Required

- `typescript`: edit `src/lib/schemas.ts` and `src/lib/settings.ts` under strict TS + Zod.

## Acceptance Criteria

- [ ] `SettingsSchema` in `src/lib/schemas.ts` contains only: `schema_version`, `curationThreshold`, `logsRetentionDays`, `lintEveryNSessions`, `proposalModel`, `curatorModel`, `bootstrapModel`. Stays `.strict()`.
- [ ] `SETTINGS_DEFAULTS` in `src/lib/settings.ts` is pruned to: `curationThreshold`, `logsRetentionDays`, `lintEveryNSessions`.
- [ ] `defaultProjectConfigBody` writes only the retained keys (the three numeric knobs above), plus `schema_version: 1`. No model keys are written by default.
- [ ] `resolveSettings` signature returns `{ settings, projectFile }`. The `userFile` and `warnings` properties are gone.
- [ ] `defaultUserConfigPath` is removed; the `XDG_CONFIG_HOME` and `homedir()`/`~/.config` lookup code is deleted.
- [ ] On YAML parse error or schema-validation failure of the project file, `resolveSettings` throws an `Error` whose message names the offending file and the validation reason. Missing project file remains a no-op (defaults only).
- [ ] `rg -n "drainBound|maxAttempts|proposalTimeout|lockTtlMs|bootstrapTokenBudget" src/lib/schemas.ts src/lib/settings.ts` returns zero hits.
- [ ] `rg -n "userFile|defaultUserConfigPath" src/lib/settings.ts` returns zero hits.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Zod `.strict()` schema; keep `ModelChoiceSchema` import unchanged.
- `EffectiveSettings` type narrows to: the three retained numeric defaults (non-optional, from `SETTINGS_DEFAULTS`) plus optional `proposalModel`, `curatorModel`, `bootstrapModel`.
- `projectConfigPath(kbDir: string)` stays as-is. `existsSync` / `readFileSync` / `yaml.load` / `SettingsSchema.safeParse` flow stays; the error branches now throw instead of pushing into a warnings array.

## Input Dependencies

None.

## Output Artifacts

- New `SettingsSchema`, `SETTINGS_DEFAULTS`, `EffectiveSettings`, `ResolveSettingsResult`, `resolveSettings`, and `defaultProjectConfigBody` in `src/lib/settings.ts` and `src/lib/schemas.ts` that downstream tasks 2, 3, 4 build on.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. In `src/lib/schemas.ts`, edit `SettingsSchema` (lines ~262-277): remove `drainBound`, `maxAttempts`, `proposalTimeout`, `lockTtlMs`, `bootstrapTokenBudget`. Keep `curationThreshold`, `logsRetentionDays`, `lintEveryNSessions`, and the three model keys. Update the JSDoc comment above the schema to reflect the project-only single-file layout (no user-level XDG file). Do not write retrospective "previously" wording.
2. In `src/lib/settings.ts`:
   - Replace `SETTINGS_DEFAULTS` (lines 12-21) with:
     ```ts
     export const SETTINGS_DEFAULTS = {
       curationThreshold: 5,
       logsRetentionDays: 30,
       lintEveryNSessions: 50,
     } as const;
     ```
   - The `EffectiveSettings` type continues to derive from `SETTINGS_DEFAULTS` keys plus the three optional model fields. No code change to the mapped-type form is required, but verify it compiles.
   - Replace `ResolveSettingsResult` with `{ settings: EffectiveSettings; projectFile: string | null }`.
   - Replace `ResolveOptions` with `{ projectFile?: string }` (drop `userFile`).
   - Rewrite `resolveSettings`:
     ```ts
     export function resolveSettings(opts: ResolveOptions = {}): ResolveSettingsResult {
       const projectFile = opts.projectFile ?? null;
       const project = projectFile ? loadFile(projectFile) : null;
       const effective: EffectiveSettings = { ...SETTINGS_DEFAULTS };
       applyOverrides(effective, project);
       return { settings: effective, projectFile };
     }
     ```
   - `applyOverrides` keeps its current shape but only iterates the retained keys plus `MODEL_CHOICE_KEYS`.
   - Rewrite `loadFile(file: string): SettingsFile | null` to throw on YAML or schema errors:
     ```ts
     function loadFile(file: string): SettingsFile | null {
       if (!existsSync(file)) return null;
       const raw = readFileSync(file, 'utf8');
       let parsed: unknown;
       try { parsed = yaml.load(raw); }
       catch (err) { throw new Error(`settings file is not valid YAML (${file}): ${(err as Error).message}`); }
       const result = SettingsSchema.safeParse(parsed);
       if (!result.success) {
         throw new Error(`settings file failed schema validation (${file}): ${result.error.message}`);
       }
       return result.data;
     }
     ```
   - Delete `defaultUserConfigPath` and its `homedir`/`join` imports if otherwise unused. Keep `join` for `projectConfigPath`.
   - `defaultProjectConfigBody` becomes:
     ```ts
     export function defaultProjectConfigBody(): string {
       const body: SettingsFile = {
         schema_version: 1,
         curationThreshold: SETTINGS_DEFAULTS.curationThreshold,
         logsRetentionDays: SETTINGS_DEFAULTS.logsRetentionDays,
         lintEveryNSessions: SETTINGS_DEFAULTS.lintEveryNSessions,
       };
       return yaml.dump(body, { indent: 2, lineWidth: 0, noRefs: true });
     }
     ```
3. Do not run the test suite from this task. Tests are updated in task 5 and will be red until then; TypeScript will surface the broken call sites that tasks 2-4 fix.

</details>
