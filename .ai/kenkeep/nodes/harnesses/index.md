---
schema_version: 2
nodes_hash: 'sha256:e158d7530914baefef23efe69966c0ee8ac137981922e37f01d22dbcf4d5b06f'
node_count: 10
summary: >-
  the per-runtime harness adapters (claude, codex, cursor, opencode, copilot)
  and the rules keeping them isolated
---
# kenkeep Index: harnesses

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Don't translate event names across harness adapters**](harnesses/practice-no-event-translation-across-adapters.md) to learn about: HookEvent is opaque string; each adapter declares the event names its host runtime emits natively. No global enum, no translation. #adapter #events #harness
- Open [**Pass --harness explicitly outside an active harness session**](harnesses/practice-explicit-harness-flag-outside-claude.md) to learn about: Claude and Cursor export in-session env markers; Codex and OpenCode do not. From those sessions or a plain shell, pass --harness explicitly or set cliDefaultHarness. #harness #cli #codex #cursor #opencode
- Open [**Adapters never reach into each other's directories**](harnesses/practice-adapters-never-cross-directories.md) to learn about: Anything shared lives under src/lib, src/commands, or src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/. #adapter #architecture #isolation
- Open [**Cursor sessionStart additional_context is silently dropped**](harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) to learn about: Cursor's sessionStart hook writes additional_context but it never reaches the model due to a confirmed race condition (May 2026). #cursor #harness #hooks #gotcha #context-injection

## Components (what exists)
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) to learn about: Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot. #harness #adapter #claude #codex #cursor #opencode #copilot #architecture
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) to learn about: Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/. #harness #cursor #hooks
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) to learn about: Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/. #harness #claude #hooks
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) to learn about: OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/. #harness #codex #hooks
- Open [**OpenCode harness adapter**](harnesses/map-opencode-harness.md) to learn about: OpenCode adapter; single TS plugin shim subscribes to event bus and dispatches session.idle/session.created to per-event Node scripts under .opencode/kk-hooks/. #harness #opencode #hooks #plugin
- Open [**Copilot harness adapter**](harnesses/map-copilot-harness-adapter.md) to learn about: GitHub Copilot CLI adapter; per-event JSON hook config at ~/.copilot/hooks/kk.json; captures on sessionEnd/agentStop from events.jsonl; skills in .github/skills/; no detectFromEnv; session-start ENTRY via a sentinel block in .github/copilot-instructions.md. #harness #copilot #hooks #adapter

## By topic

### #harness
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
### #hooks
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/.
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
### #adapter
- Open [**Copilot harness adapter**](harnesses/map-copilot-harness-adapter.md) — GitHub Copilot CLI adapter; per-event JSON hook config at ~/.copilot/hooks/kk.json; captures on sessionEnd/agentStop from events.jsonl; skills in .github/skills/; no detectFromEnv; session-start ENTRY via a sentinel block in .github/copilot-instructions.md.
- Open [**Don't translate event names across harness adapters**](harnesses/practice-no-event-translation-across-adapters.md) — HookEvent is opaque string; each adapter declares the event names its host runtime emits natively. No global enum, no translation.
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #cursor
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/.
- Open [**Cursor sessionStart additional_context is silently dropped**](harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Cursor's sessionStart hook writes additional_context but it never reaches the model due to a confirmed race condition (May 2026).
- Open [**Pass --harness explicitly outside an active harness session**](harnesses/practice-explicit-harness-flag-outside-claude.md) — Claude and Cursor export in-session env markers; Codex and OpenCode do not. From those sessions or a plain shell, pass --harness explicitly or set cliDefaultHarness.
### #codex
- Open [**Pass --harness explicitly outside an active harness session**](harnesses/practice-explicit-harness-flag-outside-claude.md) — Claude and Cursor export in-session env markers; Codex and OpenCode do not. From those sessions or a plain shell, pass --harness explicitly or set cliDefaultHarness.
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
### #opencode
- Open [**Pass --harness explicitly outside an active harness session**](harnesses/practice-explicit-harness-flag-outside-claude.md) — Claude and Cursor export in-session env markers; Codex and OpenCode do not. From those sessions or a plain shell, pass --harness explicitly or set cliDefaultHarness.
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**OpenCode harness adapter**](harnesses/map-opencode-harness.md) — OpenCode adapter; single TS plugin shim subscribes to event bus and dispatches session.idle/session.created to per-event Node scripts under .opencode/kk-hooks/.
### #architecture
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**Adapters never reach into each other's directories**](harnesses/practice-adapters-never-cross-directories.md) — Anything shared lives under src/lib, src/commands, or src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/.
- Open [**Hook behavior changes must be applied to all four harness adapters**](hooks/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the four adapters has its own copy of every hook.
### #claude
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #copilot
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**Copilot harness adapter**](harnesses/map-copilot-harness-adapter.md) — GitHub Copilot CLI adapter; per-event JSON hook config at ~/.copilot/hooks/kk.json; captures on sessionEnd/agentStop from events.jsonl; skills in .github/skills/; no detectFromEnv; session-start ENTRY via a sentinel block in .github/copilot-instructions.md.
### #cli
- Open [**Curate CLI conflict output names the three resolution outcomes**](curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**curate CLI conflict-resolution output message**](curation/map-curate-cli-conflict-resolution-output-message.md) — src/commands/curate.ts emits a multi-line message when conflicts > 0, naming the three resolution outcomes and pointing users at /kk-curate.
- Open [**curate (CLI command + /kk-curate skill)**](curation/map-curate-command.md) — Runs the curator on processed session logs. Applies add/modify/contradict/drop actions directly to nodes/. /kk-curate is the in-session equivalent.
### #context-injection
- Open [**Cursor sessionStart additional_context is silently dropped**](harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Cursor's sessionStart hook writes additional_context but it never reaches the model due to a confirmed race condition (May 2026).
### #events
- Open [**Don't translate event names across harness adapters**](harnesses/practice-no-event-translation-across-adapters.md) — HookEvent is opaque string; each adapter declares the event names its host runtime emits natively. No global enum, no translation.
### #gotcha
- Open [**Cursor sessionStart additional_context is silently dropped**](harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Cursor's sessionStart hook writes additional_context but it never reaches the model due to a confirmed race condition (May 2026).
### #isolation
- Open [**Adapters never reach into each other's directories**](harnesses/practice-adapters-never-cross-directories.md) — Anything shared lives under src/lib, src/commands, or src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/.
### #plugin
- Open [**OpenCode harness adapter**](harnesses/map-opencode-harness.md) — OpenCode adapter; single TS plugin shim subscribes to event bus and dispatches session.idle/session.created to per-event Node scripts under .opencode/kk-hooks/.
