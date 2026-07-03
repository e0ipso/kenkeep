# kenkeep Index: hooks

↑ Parent: [kenkeep](../index.md)

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
_None._

## Conventions (how we build)
- Open [**CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child**](practice-recursion-guard-kenkeep-builder-internal.md) to learn about: CLI launchers and the proposal-drain hook set KENKEEP_BUILDER_INTERNAL=1 on the harness child so nested SessionStart hooks don't re-fire. #recursion #hooks #env
- Open [**Shipped skills and hook scripts must be self-contained**](practice-shipped-skills-and-hook-scripts-must-be-self-contained.md) to learn about: Skills, CLI launchers, and hook scripts may use only Node built-ins and relative-path references — no external file dependencies. #skills #hooks #cli #packaging
- Open [**Add hermetic end-to-end capture tests per harness**](practice-add-hermetic-end-to-end-capture-tests-per-harness.md) to learn about: Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end. #testing #hooks #capture #harnesses
- Open [**Hook behavior changes must be applied to every harness adapter**](practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) to learn about: Fixing hook logic in one harness does not fix the others; each of the five adapters has its own copy of every hook. #harness #hooks #architecture #drift
- Open [**Hook status messages include kk prefix after emoji**](practice-hook-status-messages-include-kk-prefix-after-emoji.md) to learn about: All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source. #hooks #messaging #ux

## Components (what exists)
- Open [**kk-proposal-drain (extraction hook)**](map-proposal-drain-hook.md) to learn about: Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate). #hooks #extraction #llm #async #claude #billing
- Open [**kk-session-start.mjs (consume hook)**](map-session-start-hook.md) to learn about: Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext. #hooks #consume #sessionstart #index
- Open [**kk-capture.mjs (capture hook)**](map-capture-hook.md) to learn about: Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness. #hooks #capture
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](map-hook-build-pipeline-ts-to-cjs.md) to learn about: tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir. #build #hooks #tsup #templates #cjs
- Open [**kk-prompt-context.cjs (prompt-time injection)**](map-kk-prompt-context-cjs-prompt-time-injection.md) to learn about: Prompt-time hook for Claude and Codex that emits hookSpecificOutput additionalContext after the user's prompt is known. #hooks #prompt-time #codex #claude
- Open [**Per-repo notification icon asset**](map-per-repo-notification-icon-asset.md) to learn about: Linux SessionStart notifications use .ai/kenkeep/assets/notification-icon.png copied into each initialized repo. #hooks #notifications #assets

## By topic

### #hooks
- Open [**Claude Code harness adapter**](../harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**Cursor harness adapter**](../harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Codex CLI harness adapter**](../harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
### #capture
- Open [**kk-capture.mjs (capture hook)**](map-capture-hook.md) — Capture hook: reads transcript, writes _sessions/<...>.md. Sync, ≤1s deadline (OpenCode 8s). Wired per-harness.
- Open [**Usage ledger depends on successful capture**](../state/map-usage-ledger-depends-on-successful-capture.md) — usage.jsonl records node reads only from sessions whose capture hook persists usage rows.
- Open [**Add hermetic end-to-end capture tests per harness**](practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
### #claude
- Open [**Claude Code harness adapter**](../harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**kk-prompt-context.cjs (prompt-time injection)**](map-kk-prompt-context-cjs-prompt-time-injection.md) — Prompt-time hook for Claude and Codex that emits hookSpecificOutput additionalContext after the user's prompt is known.
- Open [**kk-proposal-drain (extraction hook)**](map-proposal-drain-hook.md) — Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate).
### #architecture
- Open [**Adapters never reach into each other's directories**](../harnesses/practice-adapters-never-cross-directories.md) — Anything shared lives under src/lib, src/commands, or src/templates-source/skills. Per-adapter code stays under src/harnesses/<id>/.
- Open [**Harness adapter**](../harnesses/map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
- Open [**Hook behavior changes must be applied to every harness adapter**](practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the five adapters has its own copy of every hook.
### #assets
- Open [**Per-repo notification icon asset**](map-per-repo-notification-icon-asset.md) — Linux SessionStart notifications use .ai/kenkeep/assets/notification-icon.png copied into each initialized repo.
### #async
- Open [**kk-proposal-drain (extraction hook)**](map-proposal-drain-hook.md) — Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate).
### #billing
- Open [**kk-proposal-drain (extraction hook)**](map-proposal-drain-hook.md) — Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate).
### #build
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir.
- Open [**Keep template partials out of the knowledge base**](../practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
### #cjs
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir.
### #cli
- Open [**migrate command — schema v1 to v2 migration**](../cli/map-migrate-command-schema-v1-to-v2-migration.md) — The \`migrate\` command is the correct tool for migrating a knowledge base from schema v1 to v2.
- Open [**Use a single generic migrate command for schema bumps**](../cli/practice-use-a-single-generic-migrate-command-for-schema-bumps.md) — One generic migrate command detects the current schema and dispatches the right step, rather than separate commands per bump.
- Open [**Surface schema mismatch errors on both init and node-read paths**](../cli/practice-surface-schema-mismatch-errors-on-both-init-and-node-read-paths.md) — Migration schema mismatch errors must be visible both when init runs and when node-reading commands execute.
### #codex
- Open [**Codex CLI harness adapter**](../harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
- Open [**Pass --harness explicitly outside an active harness session**](../harnesses/practice-explicit-harness-flag-outside-claude.md) — Claude and Cursor export in-session env markers; Codex/OpenCode don't. From those or a plain shell, pass --harness or set cliDefaultHarness.
- Open [**Harness adapter**](../harnesses/map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #consume
- Open [**kk-session-start.mjs (consume hook)**](map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
### #drift
- Open [**Copilot file-based SessionStart must use shared context builder**](../practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
- Open [**Hook behavior changes must be applied to every harness adapter**](practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the five adapters has its own copy of every hook.
### #env
- Open [**CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child**](practice-recursion-guard-kenkeep-builder-internal.md) — CLI launchers and the proposal-drain hook set KENKEEP_BUILDER_INTERNAL=1 on the harness child so nested SessionStart hooks don't re-fire.
### #extraction
- Open [**kk-proposal-drain (extraction hook)**](map-proposal-drain-hook.md) — Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate).
### #harness
- Open [**Cursor harness adapter**](../harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Codex CLI harness adapter**](../harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](../harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via additional_context AND the AGENTS.md sentinel, belt-and-braces.
### #harnesses
- Open [**Ignore harness JavaScript artifacts in Prettier**](../conventions/practice-ignore-harness-javascript-artifacts-in-prettier.md) — Prettier ignores JavaScript-family files under harness and agent folders, including CJS and MJS bundles.
- Open [**Add hermetic end-to-end capture tests per harness**](practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
- Open [**Cross-harness features must use adapter-level abstractions**](../harnesses/practice-cross-harness-features-must-use-adapter-level-abstractions.md) — For features spanning all harnesses, build adapter-level abstractions that work everywhere rather than assuming Claude's shape is universal.
### #index
- Open [**init and upgrade inject a static kk index pointer into AGENTS.md**](../cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md) — During init and upgrade, a static one-line pointer to ENTRY.md is appended to AGENTS.md, guarded by sentinel markers for idempotency.
- Open [**updateAgentsMd - kk index pointer injection into AGENTS.md**](../cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md) — Function in src/commands/init.ts that injects or replaces a sentinel-guarded static pointer to ENTRY.md in AGENTS.md.
- Open [**ENTRY.md**](../index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branches. Injected each session by kk-session-start; regenerated deterministically from nodes/.
### #llm
- Open [**Don't run curate or bootstrap-incremental in CI**](../conventions/practice-dont-run-llm-pipelines-in-ci.md) — Both spawn the model and produce changes to nodes/ that still need human review. CI validates what's committed, not new LLM output.
- Open [**LLM-backed migrations require explicit --harness flag**](../harnesses/practice-llm-backed-migrations-require-explicit-harness-flag.md) — Migrations that cluster nodes with an LLM must fail fast if the user did not pass --harness explicitly.
- Open [**kk-proposal-drain (extraction hook)**](map-proposal-drain-hook.md) — Async SessionStart hook sweeps _sessions/ to extract proposals; the Claude adapter's hook is a no-op (extraction runs in /kk-curate).
### #messaging
- Open [**Hook status messages include kk prefix after emoji**](practice-hook-status-messages-include-kk-prefix-after-emoji.md) — All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source.
### #notifications
- Open [**Per-repo notification icon asset**](map-per-repo-notification-icon-asset.md) — Linux SessionStart notifications use .ai/kenkeep/assets/notification-icon.png copied into each initialized repo.
### #packaging
- Open [**Shipped skills and hook scripts must be self-contained**](practice-shipped-skills-and-hook-scripts-must-be-self-contained.md) — Skills, CLI launchers, and hook scripts may use only Node built-ins and relative-path references — no external file dependencies.
### #prompt-time
- Open [**kk-prompt-context.cjs (prompt-time injection)**](map-kk-prompt-context-cjs-prompt-time-injection.md) — Prompt-time hook for Claude and Codex that emits hookSpecificOutput additionalContext after the user's prompt is known.
### #recursion
- Open [**CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child**](practice-recursion-guard-kenkeep-builder-internal.md) — CLI launchers and the proposal-drain hook set KENKEEP_BUILDER_INTERNAL=1 on the harness child so nested SessionStart hooks don't re-fire.
### #sessionstart
- Open [**kk-session-start.mjs (consume hook)**](map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
- Open [**ENTRY.md**](../index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branches. Injected each session by kk-session-start; regenerated deterministically from nodes/.
- Open [**Copilot file-based SessionStart must use shared context builder**](../practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
### #skills
- Open [**Skills-first documentation, only init is CLI**](../cli/practice-skills-first-documentation-only-init-is-cli.md) — Public docs recommend the skill workflow for curation and bootstrap; only the init command is documented as a CLI workflow.
- Open [**Shipped skills and hook scripts must be self-contained**](practice-shipped-skills-and-hook-scripts-must-be-self-contained.md) — Skills, CLI launchers, and hook scripts may use only Node built-ins and relative-path references — no external file dependencies.
- Open [**kk-session-extract**](../curation/map-kk-session-extract.md) — Shared skill for extracting durable knowledge from the visible live session and immediately curating it.
### #templates
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir.
- Open [**Keep template partials out of the knowledge base**](../practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
### #testing
- Open [**Determinism contract for ENTRY/GRAPH generation**](../index/practice-determinism-contract.md) — computeNodesHash, generateIndex/Graph, slugify, deriveNodeId, ensureUniqueId are pure; only crypto.randomUUID() (run_id) is random.
- Open [**Testing philosophy: few tests, mostly integration**](../conventions/practice-testing-philosophy-few-tests-mostly-integration.md) — This repo deliberately keeps a small test suite weighted toward integration tests; redundant unit tests are pruned.
- Open [**Add hermetic end-to-end capture tests per harness**](practice-add-hermetic-end-to-end-capture-tests-per-harness.md) — Unit tests alone miss capture regressions; each harness needs a hermetic integration test that exercises the built hook end-to-end.
### #tsup
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir.
### #ux
- Open [**Curate CLI conflict output names the three resolution outcomes**](../curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md) — When the curate CLI writes conflict files, its stdout names the accept/reject/keep-as-record outcomes and points at /kk-curate.
- Open [**Hook status messages include kk prefix after emoji**](practice-hook-status-messages-include-kk-prefix-after-emoji.md) — All user-facing hook messages follow the pattern emoji kk Label: message to identify the knowledge base as the source.