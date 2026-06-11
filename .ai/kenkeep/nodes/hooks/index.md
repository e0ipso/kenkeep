---
schema_version: 2
nodes_hash: 'sha256:763e5873fe9031fac0b2eb6b07926efddd8d34561089bc009071c2648471c442'
node_count: 7
summary: >-
  the capture, session-start, and proposal-drain hooks, how they are built, and
  the conventions they follow
---
# kenkeep Index: hooks

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

## Subfolders
_None._

## Conventions (how we build)
- Open [**CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child**](hooks/practice-recursion-guard-kenkeep-builder-internal.md) to learn about: The CLI launchers (bootstrap, curate, node add) and the proposal-drain hook must set KENKEEP_BUILDER_INTERNAL=1 on the harness child they exec so the nested session's SessionStart hooks do not re-fire. #recursion #hooks #env
- Open [**Hook behavior changes must be applied to all four harness adapters**](hooks/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) to learn about: Fixing hook logic in one harness does not fix the others; each of the four adapters has its own copy of every hook. #harness #hooks #architecture #drift
- Open [**Hook status messages include kk prefix after emoji**](hooks/practice-hook-status-messages-include-kk-prefix-after-emoji.md) to learn about: All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source. #hooks #messaging #ux

## Components (what exists)
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) to learn about: Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead. #hooks #extraction #llm #async #claude #billing
- Open [**kk-session-start.mjs (consume hook)**](hooks/map-session-start-hook.md) to learn about: Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext. #hooks #consume #sessionstart #index
- Open [**kk-capture.mjs (capture hook)**](hooks/map-capture-hook.md) to learn about: Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness. #hooks #capture
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) to learn about: tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory. #build #hooks #tsup #templates #cjs

## By topic

### #hooks
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/.
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
### #architecture
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**Adapters never reach into each other's directories**](harnesses/practice-adapters-never-cross-directories.md) — Anything shared lives under src/lib, src/commands, or src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/.
- Open [**Hook behavior changes must be applied to all four harness adapters**](hooks/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the four adapters has its own copy of every hook.
### #async
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
### #billing
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
### #build
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory.
### #capture
- Open [**kk-capture.mjs (capture hook)**](hooks/map-capture-hook.md) — Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness.
- Open [**Session log (_sessions/*.md)**](state/map-session-log.md) — Per-session checkpoint at _sessions/<YYYYMMDD-HHmm-id>.md; one file per session_id; frontmatter tracks capture, proposal, and curator phases.
### #cjs
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory.
### #claude
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime adapter implementing HarnessAdapter; declares its event vocabulary, hook/skill paths, and hook scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #consume
- Open [**kk-session-start.mjs (consume hook)**](hooks/map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
### #drift
- Open [**Hook behavior changes must be applied to all four harness adapters**](hooks/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the four adapters has its own copy of every hook.
### #env
- Open [**CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child**](hooks/practice-recursion-guard-kenkeep-builder-internal.md) — The CLI launchers (bootstrap, curate, node add) and the proposal-drain hook must set KENKEEP_BUILDER_INTERNAL=1 on the harness child they exec so the nested session's SessionStart hooks do not re-fire.
### #extraction
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
### #harness
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events; headless via agent -p; transcripts from hook stdin or ~/.cursor/projects/.../agent-transcripts/.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
### #index
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**ENTRY.md**](index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
### #llm
- Open [**kk-proposal-drain (extraction hook)**](hooks/map-proposal-drain-hook.md) — Async SessionStart hook that sweeps pending _sessions/ and extracts proposals; the Claude adapter's hook is intentionally a no-op -- extraction runs inline during /kk-curate instead.
- Open [**Don't run curate or bootstrap-incremental in CI**](conventions/practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
### #messaging
- Open [**Hook status messages include kk prefix after emoji**](hooks/practice-hook-status-messages-include-kk-prefix-after-emoji.md) — All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source.
### #recursion
- Open [**CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child**](hooks/practice-recursion-guard-kenkeep-builder-internal.md) — The CLI launchers (bootstrap, curate, node add) and the proposal-drain hook must set KENKEEP_BUILDER_INTERNAL=1 on the harness child they exec so the nested session's SessionStart hooks do not re-fire.
### #sessionstart
- Open [**ENTRY.md**](index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branch list. Injected into every new session by kk-session-start. Regenerated deterministically from nodes/.
- Open [**kk-session-start.mjs (consume hook)**](hooks/map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
### #templates
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory.
### #tsup
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hook sources into self-contained CJS bundles; build-templates copies them into templates/; init deploys to the target harness directory.
### #ux
- Open [**Curate CLI conflict output names the three resolution outcomes**](curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout message names the accept/reject/keep-as-record outcomes and points users at /kk-curate.
- Open [**Hook status messages include kk prefix after emoji**](hooks/practice-hook-status-messages-include-kk-prefix-after-emoji.md) — All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source.
