---
schema_version: 1
nodes_hash: 'sha256:40724d33d2636fba09ee3e8cd5307fd88c53e8a55ab2084285bed98037cbfd1d'
node_count: 34
---
# KB Index

_34 nodes • ~12314 estimated tokens_


## Conventions (how we build)
- **Every CLI invocation passes `--harness <id>` explicitly** [`nodes/practice/practice-explicit-harness-flag.md`] #cli #invocation #harness
- **Shared SKILL.md source resolved at runtime** [`nodes/practice/practice-shared-skill-templates.md`] #skills #templates #harness
- **All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`** [`nodes/practice/practice-cli-invocations-use-npx-scoped.md`] #cli #invocation #npx #prompts
- **All KB changes go through git review** [`nodes/practice/practice-human-in-the-loop-via-git.md`] #review #git #workflow
- **Bootstrap never overwrites an existing node** [`nodes/practice/practice-bootstrap-never-overwrites.md`] #bootstrap #prohibition #conservative
- **Bump prompt Version: on every behavior change** [`nodes/practice/practice-prompt-version-bump-on-behavior-change.md`] #prompts #versioning #llm
- **config.yaml schema is strict; unknown keys are a hard error** [`nodes/practice/practice-strict-config-yaml-schema.md`] #config #schema #strict
- **Conventional Commits drive semantic-release** [`nodes/practice/practice-conventional-commits-semantic-release.md`] #commits #release #format
- **Curator never auto-resolves contradictions** [`nodes/practice/practice-curator-never-auto-resolves-contradictions.md`] #curator #conflicts #workflow
- **Curator subprocess can only use the Read tool** [`nodes/practice/practice-curator-tools-read-only.md`] #curator #llm #tool-use
- **Don't run curate or bootstrap-incremental in CI** [`nodes/practice/practice-no-llm-pipelines-in-ci.md`] #ci #llm #prohibition
- **Every YAML/JSON shape is validated by Zod at read time** [`nodes/practice/practice-zod-validation-at-read.md`] #zod #schema #validation
- **INDEX.md and GRAPH.md are deterministic outputs of nodes/** [`nodes/practice/practice-deterministic-index-graph-regeneration.md`] #index #graph #determinism #hooks
- **KB_BUILDER_INTERNAL=1 prevents hook recursion** [`nodes/practice/practice-kb-builder-internal-recursion-guard.md`] #hooks #recursion #env #subprocess
- **Per-pipeline locks in state.json with 30-minute TTL** [`nodes/practice/practice-locking-30min-ttl.md`] #locking #state #concurrency
- **Schema bumps are a clean break; no migrators, no shims** [`nodes/practice/practice-no-migrators-clean-schema-break.md`] #schema #versioning #prohibition
- **Secretlint redacts every session transcript before write** [`nodes/practice/practice-secretlint-redaction-before-write.md`] #security #secrets #capture
- **Split combined statements into separate practice and map nodes** [`nodes/practice/practice-split-practice-and-map.md`] #extraction #prompts #modeling

## Components (what exists)
- **Assistant adapter interface** [`nodes/map/map-adapter-interface.md`] #adapter #extensibility #interface
- **Codex harness adapter** [`nodes/map/map-codex-harness-adapter.md`] #harness #adapter #codex #integration
- **Claude Code skills installed by init** [`nodes/map/map-claude-skills.md`] #skills #claude-code #slash-commands
- **OpenCode harness adapter** [`nodes/map/map-opencode-harness-adapter.md`] #harness #adapter #opencode #integration
- **@e0ipso/ai-knowledge-base npm package** [`nodes/map/map-ai-knowledge-base-package.md`] #package #cli #scope
- **Claude Code hooks registered by ai-knowledge-base** [`nodes/map/map-claude-hooks.md`] #hooks #claude-code #integration
- **.ai/knowledge-base/ directory layout** [`nodes/map/map-knowledge-base-directory.md`] #layout #directory #kb
- **.ai/knowledge-base/config.yaml** [`nodes/map/map-config-yaml.md`] #config #settings #tunables
- **.state/pending-conflicts.json** [`nodes/map/map-pending-conflicts.md`] #state #conflicts #curator
- **Map node** [`nodes/map/map-map-node.md`] #node #kind #vocabulary
- **Node frontmatter shape** [`nodes/map/map-node-frontmatter.md`] #schema #frontmatter #node
- **nodes/ directory** [`nodes/map/map-nodes-directory.md`] #layout #nodes #kb
- **Package source layout** [`nodes/map/map-source-layout.md`] #layout #source #build
- **Practice node** [`nodes/map/map-practice-node.md`] #node #kind #vocabulary
- **Prompt overrides at .config/prompts/** [`nodes/map/map-prompts-directory.md`] #prompts #customization #llm
- **Session log (_sessions/*.md)** [`nodes/map/map-session-log.md`] #sessions #capture #schema

## By topic

- **#schema (5):** config.yaml schema is strict; unknown keys are a hard error, Every YAML/JSON shape is validated by Zod at read time, Node frontmatter shape, Schema bumps are a clean break; no migrators, no shims, Session log (_sessions/*.md)
- **#harness (4):** Codex harness adapter, Every CLI invocation passes `--harness <id>` explicitly, OpenCode harness adapter, Shared SKILL.md source resolved at runtime
- **#llm (4):** Bump prompt Version: on every behavior change, Curator subprocess can only use the Read tool, Don't run curate or bootstrap-incremental in CI, Prompt overrides at .config/prompts/
- **#prompts (4):** All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`, Bump prompt Version: on every behavior change, Prompt overrides at .config/prompts/, Split combined statements into separate practice and map nodes
- **#adapter (3):** Assistant adapter interface, Codex harness adapter, OpenCode harness adapter
- **#cli (3):** Every CLI invocation passes `--harness <id>` explicitly, @e0ipso/ai-knowledge-base npm package, All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`
- **#curator (3):** .state/pending-conflicts.json, Curator never auto-resolves contradictions, Curator subprocess can only use the Read tool
- **#hooks (3):** Claude Code hooks registered by ai-knowledge-base, INDEX.md and GRAPH.md are deterministic outputs of nodes/, KB_BUILDER_INTERNAL=1 prevents hook recursion
- **#integration (3):** Codex harness adapter, OpenCode harness adapter, Claude Code hooks registered by ai-knowledge-base
- **#layout (3):** .ai/knowledge-base/ directory layout, nodes/ directory, Package source layout
- **#node (3):** Map node, Node frontmatter shape, Practice node
- **#prohibition (3):** Bootstrap never overwrites an existing node, Don't run curate or bootstrap-incremental in CI, Schema bumps are a clean break; no migrators, no shims
- **#capture (2):** Secretlint redacts every session transcript before write, Session log (_sessions/*.md)
- **#claude-code (2):** Claude Code skills installed by init, Claude Code hooks registered by ai-knowledge-base
- **#config (2):** .ai/knowledge-base/config.yaml, config.yaml schema is strict; unknown keys are a hard error
- **#conflicts (2):** .state/pending-conflicts.json, Curator never auto-resolves contradictions
- **#invocation (2):** Every CLI invocation passes `--harness <id>` explicitly, All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`
- **#kb (2):** .ai/knowledge-base/ directory layout, nodes/ directory
- **#kind (2):** Map node, Practice node
- **#skills (2):** Claude Code skills installed by init, Shared SKILL.md source resolved at runtime
- **#state (2):** .state/pending-conflicts.json, Per-pipeline locks in state.json with 30-minute TTL
- **#versioning (2):** Bump prompt Version: on every behavior change, Schema bumps are a clean break; no migrators, no shims
- **#vocabulary (2):** Map node, Practice node
- **#workflow (2):** All KB changes go through git review, Curator never auto-resolves contradictions
- **#bootstrap (1):** Bootstrap never overwrites an existing node
- **#build (1):** Package source layout
- **#ci (1):** Don't run curate or bootstrap-incremental in CI
- **#codex (1):** Codex harness adapter
- **#commits (1):** Conventional Commits drive semantic-release
- **#concurrency (1):** Per-pipeline locks in state.json with 30-minute TTL
- **#conservative (1):** Bootstrap never overwrites an existing node
- **#customization (1):** Prompt overrides at .config/prompts/
- **#determinism (1):** INDEX.md and GRAPH.md are deterministic outputs of nodes/
- **#directory (1):** .ai/knowledge-base/ directory layout
- **#env (1):** KB_BUILDER_INTERNAL=1 prevents hook recursion
- **#extensibility (1):** Assistant adapter interface
- **#extraction (1):** Split combined statements into separate practice and map nodes
- **#format (1):** Conventional Commits drive semantic-release
- **#frontmatter (1):** Node frontmatter shape
- **#git (1):** All KB changes go through git review
- **#graph (1):** INDEX.md and GRAPH.md are deterministic outputs of nodes/
- **#index (1):** INDEX.md and GRAPH.md are deterministic outputs of nodes/
- **#interface (1):** Assistant adapter interface
- **#locking (1):** Per-pipeline locks in state.json with 30-minute TTL
- **#modeling (1):** Split combined statements into separate practice and map nodes
- **#nodes (1):** nodes/ directory
- **#npx (1):** All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`
- **#opencode (1):** OpenCode harness adapter
- **#package (1):** @e0ipso/ai-knowledge-base npm package
- **#recursion (1):** KB_BUILDER_INTERNAL=1 prevents hook recursion
- **#release (1):** Conventional Commits drive semantic-release
- **#review (1):** All KB changes go through git review
- **#scope (1):** @e0ipso/ai-knowledge-base npm package
- **#secrets (1):** Secretlint redacts every session transcript before write
- **#security (1):** Secretlint redacts every session transcript before write
- **#sessions (1):** Session log (_sessions/*.md)
- **#settings (1):** .ai/knowledge-base/config.yaml
- **#slash-commands (1):** Claude Code skills installed by init
- **#source (1):** Package source layout
- **#strict (1):** config.yaml schema is strict; unknown keys are a hard error
- **#subprocess (1):** KB_BUILDER_INTERNAL=1 prevents hook recursion
- **#templates (1):** Shared SKILL.md source resolved at runtime
- **#tool-use (1):** Curator subprocess can only use the Read tool
- **#tunables (1):** .ai/knowledge-base/config.yaml
- **#validation (1):** Every YAML/JSON shape is validated by Zod at read time
- **#zod (1):** Every YAML/JSON shape is validated by Zod at read time
