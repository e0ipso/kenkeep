# kenkeep Index: harnesses / adapters

↑ Parent: [harnesses](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) to learn about: Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status. #copilot #harness #hooks #sessionstart #context-injection #drift
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](practice-cursor-sessionstart-additional-context-is-silently-dropped.md) to learn about: Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via additional_context AND the AGENTS.md sentinel, belt-and-braces. #cursor #harness #hooks #context-injection

## Components (what exists)
- Open [**Harness adapter**](map-harness-adapter.md) to learn about: Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot. #harness #adapter #claude #codex #cursor #opencode #copilot #architecture
- Open [**Claude Code harness adapter**](map-claude-harness.md) to learn about: Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/. #harness #claude #hooks
- Open [**Codex CLI harness adapter**](map-codex-harness.md) to learn about: OpenAI Codex CLI adapter; capture on Stop and PreCompact, lint tick on Stop only (no SessionEnd); skills under .agents/skills/. #harness #codex #hooks
- Open [**Cursor harness adapter**](map-cursor-harness-adapter.md) to learn about: Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count. #harness #cursor #hooks
- Open [**Copilot harness adapter**](map-copilot-harness-adapter.md) to learn about: GitHub Copilot CLI adapter; repo-level .github/hooks/kk.json; captures on sessionEnd/agentStop; skills in .github/skills/; sentinel ENTRY. #harness #copilot #hooks #adapter
- Open [**OpenCode harness adapter**](map-opencode-harness.md) to learn about: OpenCode adapter; plugin shim dispatches session.idle/created to kk-hooks/; capture via opencode export with raw ses_ id, temp-file stdout. #harness #opencode #hooks #plugin

## By topic

### #harness
- Open [**Cursor harness adapter**](map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Codex CLI harness adapter**](map-codex-harness.md) — OpenAI Codex CLI adapter; capture on Stop and PreCompact, lint tick on Stop only (no SessionEnd); skills under .agents/skills/.
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via additional_context AND the AGENTS.md sentinel, belt-and-braces.
### #hooks
- Open [**Claude Code harness adapter**](map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**Cursor harness adapter**](map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Codex CLI harness adapter**](map-codex-harness.md) — OpenAI Codex CLI adapter; capture on Stop and PreCompact, lint tick on Stop only (no SessionEnd); skills under .agents/skills/.
### #copilot
- Open [**Copilot harness adapter**](map-copilot-harness-adapter.md) — GitHub Copilot CLI adapter; repo-level .github/hooks/kk.json; captures on sessionEnd/agentStop; skills in .github/skills/; sentinel ENTRY.
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
- Open [**Harness adapter**](map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #cursor
- Open [**Cursor harness adapter**](map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via additional_context AND the AGENTS.md sentinel, belt-and-braces.
- Open [**Pass --harness explicitly outside an active harness session**](../cross-harness/practice-explicit-harness-flag-outside-claude.md) — Claude and Cursor export in-session env markers; Codex/OpenCode don't. From those or a plain shell, pass --harness or set cliDefaultHarness.
### #adapter
- Open [**Copilot harness adapter**](map-copilot-harness-adapter.md) — GitHub Copilot CLI adapter; repo-level .github/hooks/kk.json; captures on sessionEnd/agentStop; skills in .github/skills/; sentinel ENTRY.
- Open [**Don't translate event names across harness adapters**](../cross-harness/practice-no-event-translation-across-adapters.md) — HookEvent is opaque string; each adapter declares the event names its host runtime emits natively. No global enum, no translation.
- Open [**Harness adapter**](map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #claude
- Open [**Claude Code harness adapter**](map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**kk-prompt-context.cjs (prompt-time injection)**](../../hooks/map-kk-prompt-context-cjs-prompt-time-injection.md) — Prompt-time hook for Claude and Codex that emits hookSpecificOutput additionalContext after the user's prompt is known.
- Open [**kk-proposal-drain (extraction hook)**](../../hooks/map-proposal-drain-hook.md) — Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate).
### #codex
- Open [**Codex CLI harness adapter**](map-codex-harness.md) — OpenAI Codex CLI adapter; capture on Stop and PreCompact, lint tick on Stop only (no SessionEnd); skills under .agents/skills/.
- Open [**Pass --harness explicitly outside an active harness session**](../cross-harness/practice-explicit-harness-flag-outside-claude.md) — Claude and Cursor export in-session env markers; Codex/OpenCode don't. From those or a plain shell, pass --harness or set cliDefaultHarness.
- Open [**Harness adapter**](map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #context-injection
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via additional_context AND the AGENTS.md sentinel, belt-and-braces.
### #opencode
- Open [**Pass --harness explicitly outside an active harness session**](../cross-harness/practice-explicit-harness-flag-outside-claude.md) — Claude and Cursor export in-session env markers; Codex/OpenCode don't. From those or a plain shell, pass --harness or set cliDefaultHarness.
- Open [**Harness adapter**](map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**OpenCode harness adapter**](map-opencode-harness.md) — OpenCode adapter; plugin shim dispatches session.idle/created to kk-hooks/; capture via opencode export with raw ses_ id, temp-file stdout.
### #architecture
- Open [**Adapters never reach into each other's directories**](../cross-harness/practice-adapters-never-cross-directories.md) — Anything shared lives under src/lib, src/commands, or src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/.
- Open [**Harness adapter**](map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**Hook behavior changes must be applied to every harness adapter**](../../hooks/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the five adapters has its own copy of every hook.
### #drift
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
- Open [**Hook behavior changes must be applied to every harness adapter**](../../hooks/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the five adapters has its own copy of every hook.
### #plugin
- Open [**OpenCode harness adapter**](map-opencode-harness.md) — OpenCode adapter; plugin shim dispatches session.idle/created to kk-hooks/; capture via opencode export with raw ses_ id, temp-file stdout.
### #sessionstart
- Open [**kk-session-start.mjs (consume hook)**](../../hooks/map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
- Open [**ENTRY.md**](../../index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branches. Injected each session by kk-session-start; regenerated deterministically from nodes/.
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.