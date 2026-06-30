---
id: 2
group: "configuration"
dependencies: []
status: "completed"
created: 2026-06-29
skills:
  - settings-schema
  - vitest
complexity_score: 5
complexity_notes: "Strict config parsing, defaults, generated/default config text, and tests must stay synchronized."
---
# Add default-on notification configuration

## Objective
Extend kenkeep settings with a strict nested `notifications` object whose global `enabled` flag defaults to `true` and disables every OS notification backend when set to `false`.

## Skills Required
Settings schema/resolver changes and Vitest coverage for strict config behavior.

## Acceptance Criteria
- [ ] `notifications.enabled` is accepted in `.ai/kenkeep/config.yaml`, defaults to `true` when omitted, and is exposed through the effective settings consumed by hooks.
- [ ] The notifications config is nested and strict. Malformed values and unknown nested keys are rejected by the same settings validation path as existing config errors.
- [ ] The schema leaves an explicit nested place for future backend-specific configuration, but this task does not implement `ntfy`, network delivery, credentials, topics, per-backend enable switches, or any non-local backend.
- [ ] Default config generation/comments are updated so newly initialized repos can discover `notifications.enabled: false` as the global opt-out.
- [ ] No persisted `schema_version` bump is introduced, because this is an optional additive settings shape.
- [ ] `npm test -- tests/lib/settings.test.ts` exits 0 and proves the default-on behavior, global opt-out, malformed nested config rejection, and unknown-key rejection.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Update the existing settings schema, effective settings type, resolver defaults, and default config text together.
- Preserve the repo's strict-config behavior; do not relax top-level or nested unknown-key handling to make the new object fit.
- Keep the user-facing switch global across all notification backends. Do not introduce per-backend toggles in this issue.

## Input Dependencies
None.

## Output Artifacts
Updated settings schema/resolution, default config output, and focused settings tests. Task 3 consumes the effective `notifications.enabled` value.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Locate the current settings schema and default config generation with `rg "SettingsSchema|config.yaml|default config|stale|lint"` from the repository root.
3. Model the shape as a nested object with `enabled` defaulting to `true`. If you reserve future backend config space, keep it explicit and strict; do not accept arbitrary backend keys unless the project already has a typed pattern for reserved empty objects.
4. Update effective settings consumers only enough to expose the new setting. The hook integration belongs in Task 3.
5. Add or update settings tests near the existing settings coverage. Verify both omitted config and explicitly empty `notifications: {}` resolve to enabled notifications if that matches the chosen schema shape.
6. Test philosophy - write a few tests, mostly integration. Meaningful tests verify custom business logic, critical paths, and edge cases specific to this application. Test your code, not the framework or library. Focus on parser/resolver behavior and rejection messages, not YAML library mechanics.
</details>
