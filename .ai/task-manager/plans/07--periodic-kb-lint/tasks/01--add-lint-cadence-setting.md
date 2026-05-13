---
id: 1
group: "settings"
dependencies: []
status: "pending"
created: 2026-05-13
skills:
  - typescript
---
# Add `lintEveryNSessions` setting

## Objective

Extend the strict `SettingsSchema` and the `SETTINGS_DEFAULTS` table with a single new optional field, `lintEveryNSessions`, defaulting to `50`. Also extend `defaultProjectConfigBody()` so freshly-written `config.yaml` files surface the key with its documented default. No schema-version bump.

## Skills Required

- typescript: edit a zod schema, an exported defaults constant, a YAML-emitting helper, and the `EffectiveSettings` mapped type that derives from `SETTINGS_DEFAULTS`.

## Acceptance Criteria

- [ ] `SettingsSchema` in `src/lib/schemas.ts` has `lintEveryNSessions: z.number().int().positive().optional()` added alongside the other optional numeric fields. Strict mode (`.strict()`) is preserved.
- [ ] `SETTINGS_DEFAULTS` in `src/lib/settings.ts` has `lintEveryNSessions: 50` added.
- [ ] `defaultProjectConfigBody()` in `src/lib/settings.ts` includes `lintEveryNSessions: SETTINGS_DEFAULTS.lintEveryNSessions` in the emitted YAML.
- [ ] `EffectiveSettings` automatically picks up the new key because it derives from `typeof SETTINGS_DEFAULTS`; no manual edits needed there.
- [ ] `npm run typecheck` passes after the change (no consumer reads the key yet; that comes in later tasks).
- [ ] No retrospective comments. No schema-version bump.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Files: `src/lib/schemas.ts` (around line 255-269) and `src/lib/settings.ts` (defaults table at lines 12-20; `defaultProjectConfigBody` at lines 133-145).
- The `SettingsSchema` uses `.strict()`, so any new key must also be added to the schema or the project config file will fail validation. Add it to both the schema and the default body in the same task.
- `EffectiveSettings` is `{ -readonly [K in keyof typeof SETTINGS_DEFAULTS]: ... }`, so adding `lintEveryNSessions` to the defaults automatically widens the type. No need to touch the type alias.

## Input Dependencies

None.

## Output Artifacts

- Edited `src/lib/schemas.ts`.
- Edited `src/lib/settings.ts`.

## Implementation Notes

<details>
<summary>Step-by-step implementation guidance</summary>

1. In `src/lib/schemas.ts`, locate the `SettingsSchema` definition (around line 255). It is a `z.object({...}).strict()`. Add a new line inside the object literal, ordered after `logsRetentionDays`:

   ```ts
   lintEveryNSessions: z.number().int().positive().optional(),
   ```

2. In `src/lib/settings.ts`, locate `SETTINGS_DEFAULTS` (around line 12). Add:

   ```ts
   lintEveryNSessions: 50,
   ```

   Keep the surrounding ordering. The `as const` assertion is unchanged.

3. In the same file, locate `defaultProjectConfigBody()` (around line 133). The `body` object enumerates each key explicitly. Add:

   ```ts
   lintEveryNSessions: SETTINGS_DEFAULTS.lintEveryNSessions,
   ```

   inside the literal so it ends up in the rendered YAML.

4. Run `npm run typecheck`. Should be clean: `EffectiveSettings` updates automatically, no consumer reads the key yet.

5. Do not add explanatory comments; the field is self-describing. The README task documents the user-facing meaning separately.

</details>
