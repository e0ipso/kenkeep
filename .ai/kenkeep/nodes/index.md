---
okf_version: '0.1'
---
# kenkeep Index

> kenkeep navigation: the injected body above is the root index node, the top-level catalog of branches and root-level leaves. Do not expect the whole knowledge base here; descend on demand. Read the root index node, pick one or more branches whose intent and tags match your task (several branches can be relevant), and read those branch `index.md` nodes. Descend further only where the task needs it, opening only the leaves you have confirmed are relevant. Follow each leaf's `relates_to` and `depends_on` cross edges to reach related leaves in other branches. You decide how deep to go per branch.

> This index only orients you; leaves hold the durable guidance. Open at least one relevant leaf before acting.

## Subfolders
- Load [`bootstrap/`](bootstrap/index.md) for more information on seeding the knowledge base from existing docs via /kk-bootstrap; read when bootstrapping a repo or folding new docs in.
- Load [`cli/`](cli/index.md) for more information on the init/upgrade commands and AGENTS.md pointer injection; read when changing the CLI surface or install behavior.
- Load [`config-and-prompts/`](config-and-prompts/index.md) for more information on config.yaml settings and the prompt templates with their versioning; read when adding a setting or touching a prompt.
- Load [`conventions/`](conventions/index.md) for more information on commit, release, testing, CI, and writing-style rules; read before committing, releasing, or writing docs.
- Load [`curation/`](curation/index.md) for more information on the curator pipeline from proposals to nodes, including conflicts; read when changing curation, dedup, or conflict handling.
- Load [`harnesses/`](harnesses/index.md) for more information on the five harness adapters and their isolation rules; read before adding a harness, changing hook wiring, or debugging a host integration.
- Load [`hooks/`](hooks/index.md) for more information on the capture, session-start, drain, and lint-tick hooks and how they are built; read when changing any hook behavior.
- Load [`index/`](index/index.md) for more information on the deterministic ENTRY/GRAPH/index generation and nodes_hash; read when touching index generation or staleness checks.
- Load [`node-schema/`](node-schema/index.md) for more information on node frontmatter, naming, and schema-version rules; read before changing any node field or bumping the schema.
- Load [`overview/`](overview/index.md) for more information on what kenkeep is and the on-disk .ai/kenkeep layout; read first when new to the project.
- Load [`pack/`](pack/index.md) for more information on Knowledge pack import, export, manifest, and safety rules.
- Load [`state/`](state/index.md) for more information on session logs and runtime state files; read when changing capture state, locks, or proposal tracking.

## Conventions (how we build)
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) to learn about: Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status. #copilot #harness #hooks #sessionstart #context-injection #drift
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) to learn about: Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown. #templates #prompts #knowledge-base #build
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) to learn about: In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH. #git #github #gh #authentication #remote #push #environment

## Components (what exists)
_None yet._

## By topic

### #authentication
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #build
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir.
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
### #context-injection
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via additional_context AND the AGENTS.md sentinel, belt-and-braces.
### #copilot
- Open [**Copilot harness adapter**](harnesses/map-copilot-harness-adapter.md) — GitHub Copilot CLI adapter; repo-level .github/hooks/kk.json; captures on sessionEnd/agentStop; skills in .github/skills/; sentinel ENTRY.
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
- Open [**Harness adapter**](harnesses/map-harness-adapter.md) — Per-runtime HarnessAdapter declaring event vocabulary, hook/skill paths, and scripts. Five ship: claude, codex, cursor, opencode, copilot.
### #drift
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
- Open [**Hook behavior changes must be applied to every harness adapter**](hooks/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md) — Fixing hook logic in one harness does not fix the others; each of the five adapters has its own copy of every hook.
### #environment
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #gh
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #git
- Open [**Never force push**](conventions/practice-never-force-push.md) — Force pushing rewrites remote history and can lose collaborators' work.
- Open [**Conventional Commits drive semantic-release**](conventions/practice-conventional-commits-and-release.md) — semantic-release automates releases on merge to main; commit type (feat/fix/etc.) sets the version bump; no manual tag or npm publish.
- Open [**Review node changes via git**](conventions/practice-review-nodes-via-git.md) — All node changes are reviewed via git diff: accept with git commit, reject with git restore. Same for curator and bootstrap output.
### #github
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #harness
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
- Open [**Cursor sessionStart additional_context delivery was fixed upstream**](harnesses/practice-cursor-sessionstart-additional-context-is-silently-dropped.md) — Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via additional_context AND the AGENTS.md sentinel, belt-and-braces.
### #hooks
- Open [**Cursor harness adapter**](harnesses/map-cursor-harness-adapter.md) — Cursor IDE agent adapter; camelCase hooks.json events; headless via agent -p; transcripts in agent-transcripts/; Read+ReadFile both count.
- Open [**Claude Code harness adapter**](harnesses/map-claude-harness.md) — Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in .claude/settings.json, installs skills at .claude/skills/.
- Open [**Codex CLI harness adapter**](harnesses/map-codex-harness.md) — OpenAI Codex CLI adapter; capture and lint tick on Stop only (no SessionEnd/PreCompact); skills under .agents/skills/.
### #knowledge-base
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
### #prompts
- Open [**Bump the prompt's Version comment on every behavior change**](config-and-prompts/practice-bump-prompt-version-comment.md) — Each prompt template carries a top-of-file Version: N comment. Bump it on every behavior change; logs record it so audits stay coherent.
- Open [**Local prompt overrides fall back to bundled templates**](config-and-prompts/practice-local-prompt-overrides-fall-back-to-bundled.md) — Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md, then the bundled fallback; delete the override to revert.
- Open [**Curator drops non-productive and change-oriented candidates**](curation/practice-curator-drops-non-productive-candidates.md) — Change-oriented framing is auto-dropped; hedged, plan-scoped, or low-confidence signatures signal an abandoned-session leak.
### #push
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #remote
- Open [**Use origin-https with gh-minted auth for pushes**](practice-use-origin-https-with-gh-minted-auth-for-pushes.md) — In this environment, push GitHub changes through origin-https using a token minted by gh rather than SSH.
### #sessionstart
- Open [**kk-session-start.mjs (consume hook)**](hooks/map-session-start-hook.md) — Sync SessionStart hook with 1s deadline; loads ENTRY.md, checks freshness, may append curate nudge, emits additionalContext.
- Open [**ENTRY.md**](index/map-entry-md.md) — Entry catalog: whole-tree totals + top-level branches. Injected each session by kk-session-start; regenerated deterministically from nodes/.
- Open [**Copilot file-based SessionStart must use shared context builder**](practice-copilot-file-based-sessionstart-must-use-shared-context-builder.md) — Copilot lacks additionalContext, but its sentinel bridge must still preserve shared SessionStart status.
### #templates
- Open [**Hook build pipeline: TS sources to deployed .cjs bundles**](hooks/map-hook-build-pipeline-ts-to-cjs.md) — tsup compiles per-adapter TS hooks into self-contained CJS bundles; build-templates copies them to templates/; init deploys to harness dir.
- Open [**Keep template partials out of the knowledge base**](practice-keep-template-partials-out-of-the-knowledge-base.md) — Use build-time partials only for shipped prompt/skill sources, never generated or curated KB markdown.
