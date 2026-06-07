---
schema_version: 2
nodes_hash: 'sha256:7781e6ec1838022e65438feabd752a79eefca2265184eb5872f994e35683f8f4'
node_count: 11
---
# kenkeep Index: harness

_11 node(s) in this folder • ~4849 estimated tokens_

## Subfolders
_None._

## Conventions (how we build)
- **Don't translate event names across harness adapters** [`harness/practice-no-event-translation-across-adapters.md`] HookEvent is opaque string; each adapter declares the event names its host runtime emits natively. No global enum, no translation. #adapter #events #harness
- **Pass --harness explicitly outside an active harness session** [`harness/practice-explicit-harness-flag-outside-claude.md`] Claude and Cursor export in-session env markers; Codex and OpenCode do not. From those sessions or a plain shell, pass --harness explicitly or set cliDefaultHarness. #harness #cli #codex #cursor #opencode
- **Adapters never reach into each other's directories** [`harness/practice-adapters-never-cross-directories.md`] Anything shared lives under src/lib, src/commands, or src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/. #adapter #architecture #isolation
- **Cursor sessionStart additional_context is silently dropped** [`harness/practice-cursor-sessionstart-additional-context-is-silently-dropped.md`] Cursor's sessionStart hook writes additional_context but it never reaches the model due to a confirmed race condition (May 2026). #cursor #harness #hooks #gotcha #context-injection
- **Hook behavior changes must be applied to all four harness adapters** [`harness/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md`] Fixing hook logic in one harness does not fix the others; each of the four adapters has its own copy of every hook. #harness #hooks #architecture #drift

## Components (what exists)
- **Harness adapter** [`harness/map-harness-adapter.md`] Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot. #harness #adapter #claude #codex #cursor #opencode #copilot #architecture
- **Cursor harness adapter** [`harness/map-cursor-harness-adapter.md`] Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/. #harness #cursor #hooks
- **Claude Code harness adapter** [`harness/map-claude-harness.md`] Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/. #harness #claude #hooks
- **Codex CLI harness adapter** [`harness/map-codex-harness.md`] OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/. #harness #codex #hooks
- **OpenCode harness adapter** [`harness/map-opencode-harness.md`] OpenCode adapter; single TS plugin shim subscribes to event bus and dispatches session.idle/session.created to per-event Node scripts under .opencode/kk-hooks/. #harness #opencode #hooks #plugin
- **Copilot harness adapter** [`harness/map-copilot-harness-adapter.md`] GitHub Copilot CLI adapter; per-event JSON hook config at ~/.copilot/hooks/kk.json; captures on sessionEnd/agentStop from events.jsonl; skills in .github/skills/; no detectFromEnv; session-start ENTRY via a sentinel block in .github/copilot-instructions.md. #harness #copilot #hooks #adapter

## By topic

- **#harness (10):** Harness adapter, Cursor harness adapter, Claude Code harness adapter, Codex CLI harness adapter, OpenCode harness adapter, Copilot harness adapter, Don't translate event names across harness adapters, Pass --harness explicitly outside an active harness session, Cursor sessionStart additional_context is silently dropped, Hook behavior changes must be applied to all four harness adapters
- **#hooks (7):** Cursor harness adapter, Claude Code harness adapter, Codex CLI harness adapter, OpenCode harness adapter, Copilot harness adapter, Cursor sessionStart additional_context is silently dropped, Hook behavior changes must be applied to all four harness adapters
- **#adapter (4):** Harness adapter, Copilot harness adapter, Don't translate event names across harness adapters, Adapters never reach into each other's directories
- **#cursor (4):** Harness adapter, Cursor harness adapter, Pass --harness explicitly outside an active harness session, Cursor sessionStart additional_context is silently dropped
- **#architecture (3):** Harness adapter, Adapters never reach into each other's directories, Hook behavior changes must be applied to all four harness adapters
- **#codex (3):** Harness adapter, Codex CLI harness adapter, Pass --harness explicitly outside an active harness session
- **#opencode (3):** Harness adapter, OpenCode harness adapter, Pass --harness explicitly outside an active harness session
- **#claude (2):** Harness adapter, Claude Code harness adapter
- **#copilot (2):** Harness adapter, Copilot harness adapter
- **#cli (1):** Pass --harness explicitly outside an active harness session
- **#context-injection (1):** Cursor sessionStart additional_context is silently dropped
- **#drift (1):** Hook behavior changes must be applied to all four harness adapters
- **#events (1):** Don't translate event names across harness adapters
- **#gotcha (1):** Cursor sessionStart additional_context is silently dropped
- **#isolation (1):** Adapters never reach into each other's directories
- **#plugin (1):** OpenCode harness adapter
