---
id: 4
group: "documentation"
dependencies: [2, 3]
status: "pending"
created: 2026-06-29
skills:
  - technical-writing
  - build-verification
complexity_score: 5
complexity_notes: "Documentation spans config, hook internals, user-facing upgrade behavior, and final drift-sensitive verification."
---
# Document notification behavior and verify the shipped artifacts

## Objective
Document the new default-on native OS notification behavior, the global opt-out, and the best-effort backend semantics, then run the final build and quality gates that prove the hook bundles and docs agree with the implementation.

## Skills Required
Technical writing for config/hook/user docs and build verification across generated hook artifacts.

## Acceptance Criteria
- [ ] Config documentation describes the nested `notifications` object, states that `notifications.enabled` defaults to `true`, and shows `notifications.enabled: false` as the global opt-out.
- [ ] Hook internals documentation states that actionable SessionStart nudges continue through existing assistant/context channels and are additionally attempted through native OS notifications when enabled and available.
- [ ] User-facing daily-use, installation, or upgrade documentation explains why desktop notifications may appear after upgrade, which local backends are supported (`osascript` on macOS, `notify-send` on Linux), and that missing/headless backends are skipped silently.
- [ ] `ntfy` is mentioned only as out of scope or future explicit opt-in if it is mentioned at all. No docs imply that kenkeep sends network notifications in this issue.
- [ ] `CHANGELOG.md` records the default-on OS notification feature under the repo's Unreleased section if that section exists.
- [ ] `npm run build` exits 0, and the generated hook artifacts for Claude, Codex, Cursor, and OpenCode include the notification helper after the build.
- [ ] `npm run typecheck`, `npm run lint`, and `npm test -- tests/lib/settings.test.ts tests/hooks/kk-session-start.test.ts` exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Keep docs scoped to the actual implemented behavior. Do not document Copilot parity as complete unless issue #70 has landed in the same branch.
- Do not hand-edit generated `templates/`; if implementation changes generated hook or template artifacts, use the repository build pipeline.
- Preserve the constitution: no daemons, no background services, no external runtime, and no network backend introduced by documentation implication.

## Input Dependencies
Task 2 config behavior and Task 3 hook integration.

## Output Artifacts
Updated human-facing documentation, changelog entry if applicable, generated hook bundle verification, and final command results.

## Implementation Notes
<details>
<summary>Execution guidance</summary>

1. First read `<root>/config/hooks/PRE_TASK_EXECUTION.md` and follow it.
2. Use `rg "config.yaml|settings|SessionStart|hooks|install|daily|CHANGELOG|notification"` to locate the smallest doc set that already describes configuration and hook behavior.
3. Update only docs that directly cover config, hook internals, daily-use/install/upgrade behavior, or changelog. Do not add a new AGENTS.md convention unless implementation discovers a durable rule beyond the existing hook, config, and no-daemon principles.
4. Make the default-on behavior explicit and concise: users may receive local desktop notifications after upgrade if their OS has a supported local backend; `notifications.enabled: false` disables all OS notification attempts.
5. State best-effort semantics plainly. Missing `osascript`/`notify-send`, denied OS permissions, headless environments, SSH, CI, WSL, missing DBus, or unavailable notification daemons are skipped silently and are not kenkeep errors.
6. Run the final verification commands listed in the acceptance criteria. If a command fails, fix the implementation or docs rather than weakening the verification.
</details>
