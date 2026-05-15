---
schema_version: 1
nodes_hash: 'sha256:40724d33d2636fba09ee3e8cd5307fd88c53e8a55ab2084285bed98037cbfd1d'
node_count: 34
---
# KB Graph

Total nodes: 34

## map-adapter-interface

- **kind:** map
- **title:** Assistant adapter interface
- **tags:** adapter, extensibility, interface
- **derived_from:** docs/internals/architecture.md

## map-ai-knowledge-base-package

- **kind:** map
- **title:** @e0ipso/ai-knowledge-base npm package
- **tags:** package, cli, scope
- **derived_from:** README.md, PRD.md, IMPLEMENTATION.md

## map-claude-hooks

- **kind:** map
- **title:** Claude Code hooks registered by ai-knowledge-base
- **tags:** hooks, claude-code, integration
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## map-claude-skills

- **kind:** map
- **title:** Claude Code skills installed by init
- **tags:** skills, claude-code, slash-commands
- **derived_from:** docs/cli-reference.md, PRD.md, IMPLEMENTATION.md

## map-codex-harness-adapter

- **kind:** map
- **title:** Codex harness adapter
- **tags:** harness, adapter, codex, integration
- **relates_to:** map-adapter-interface, practice-explicit-harness-flag, map-claude-hooks

## map-config-yaml

- **kind:** map
- **title:** .ai/knowledge-base/config.yaml
- **tags:** config, settings, tunables
- **derived_from:** docs/cli-reference.md, PRD.md

## map-knowledge-base-directory

- **kind:** map
- **title:** .ai/knowledge-base/ directory layout
- **tags:** layout, directory, kb
- **derived_from:** docs/internals/architecture.md, IMPLEMENTATION.md

## map-map-node

- **kind:** map
- **title:** Map node
- **tags:** node, kind, vocabulary
- **derived_from:** PRD.md, docs/internals/schemas.md

## map-node-frontmatter

- **kind:** map
- **title:** Node frontmatter shape
- **tags:** schema, frontmatter, node
- **derived_from:** docs/internals/schemas.md

## map-nodes-directory

- **kind:** map
- **title:** nodes/ directory
- **tags:** layout, nodes, kb
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md

## map-opencode-harness-adapter

- **kind:** map
- **title:** OpenCode harness adapter
- **tags:** harness, adapter, opencode, integration
- **relates_to:** map-adapter-interface, practice-explicit-harness-flag, practice-shared-skill-templates, map-codex-harness-adapter

## map-pending-conflicts

- **kind:** map
- **title:** .state/pending-conflicts.json
- **tags:** state, conflicts, curator
- **derived_from:** docs/internals/schemas.md, docs/how-it-works.md

## map-practice-node

- **kind:** map
- **title:** Practice node
- **tags:** node, kind, vocabulary
- **derived_from:** PRD.md, docs/internals/schemas.md, docs/how-it-works.md

## map-prompts-directory

- **kind:** map
- **title:** Prompt overrides at .config/prompts/
- **tags:** prompts, customization, llm
- **derived_from:** docs/internals/prompts.md

## map-session-log

- **kind:** map
- **title:** Session log (_sessions/*.md)
- **tags:** sessions, capture, schema
- **derived_from:** docs/internals/hooks.md, docs/internals/schemas.md

## map-source-layout

- **kind:** map
- **title:** Package source layout
- **tags:** layout, source, build
- **derived_from:** CONTRIBUTING.md, docs/internals/architecture.md

## practice-bootstrap-never-overwrites

- **kind:** practice
- **title:** Bootstrap never overwrites an existing node
- **tags:** bootstrap, prohibition, conservative
- **derived_from:** PRD.md, docs/installation.md, docs/daily-use.md

## practice-cli-invocations-use-npx-scoped

- **kind:** practice
- **title:** All CLI invocations use `npx @e0ipso/ai-knowledge-base ...`
- **tags:** cli, invocation, npx, prompts
- **relates_to:** map-ai-knowledge-base-package, map-claude-skills

## practice-conventional-commits-semantic-release

- **kind:** practice
- **title:** Conventional Commits drive semantic-release
- **tags:** commits, release, format
- **derived_from:** CONTRIBUTING.md

## practice-curator-never-auto-resolves-contradictions

- **kind:** practice
- **title:** Curator never auto-resolves contradictions
- **tags:** curator, conflicts, workflow
- **derived_from:** PRD.md, docs/how-it-works.md, docs/internals/prompts.md

## practice-curator-tools-read-only

- **kind:** practice
- **title:** Curator subprocess can only use the Read tool
- **tags:** curator, llm, tool-use
- **derived_from:** docs/internals/prompts.md

## practice-deterministic-index-graph-regeneration

- **kind:** practice
- **title:** INDEX.md and GRAPH.md are deterministic outputs of nodes/
- **tags:** index, graph, determinism, hooks
- **derived_from:** docs/internals/architecture.md, docs/internals/schemas.md, docs/cli-reference.md

## practice-explicit-harness-flag

- **kind:** practice
- **title:** Every CLI invocation passes `--harness <id>` explicitly
- **tags:** cli, invocation, harness
- **relates_to:** practice-cli-invocations-use-npx-scoped, practice-shared-skill-templates, map-codex-harness-adapter, map-opencode-harness-adapter, map-adapter-interface

## practice-human-in-the-loop-via-git

- **kind:** practice
- **title:** All KB changes go through git review
- **tags:** review, git, workflow
- **derived_from:** PRD.md, docs/how-it-works.md, docs/daily-use.md

## practice-kb-builder-internal-recursion-guard

- **kind:** practice
- **title:** KB_BUILDER_INTERNAL=1 prevents hook recursion
- **tags:** hooks, recursion, env, subprocess
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## practice-locking-30min-ttl

- **kind:** practice
- **title:** Per-pipeline locks in state.json with 30-minute TTL
- **tags:** locking, state, concurrency
- **derived_from:** docs/internals/architecture.md, docs/troubleshooting.md

## practice-no-llm-pipelines-in-ci

- **kind:** practice
- **title:** Don't run curate or bootstrap-incremental in CI
- **tags:** ci, llm, prohibition
- **derived_from:** docs/daily-use.md, docs/installation.md

## practice-no-migrators-clean-schema-break

- **kind:** practice
- **title:** Schema bumps are a clean break; no migrators, no shims
- **tags:** schema, versioning, prohibition
- **derived_from:** CONTRIBUTING.md, PRD.md

## practice-prompt-version-bump-on-behavior-change

- **kind:** practice
- **title:** Bump prompt Version: on every behavior change
- **tags:** prompts, versioning, llm
- **derived_from:** CONTRIBUTING.md, docs/internals/prompts.md

## practice-secretlint-redaction-before-write

- **kind:** practice
- **title:** Secretlint redacts every session transcript before write
- **tags:** security, secrets, capture
- **derived_from:** PRD.md, docs/internals/hooks.md, docs/installation.md

## practice-shared-skill-templates

- **kind:** practice
- **title:** Shared SKILL.md source resolved at runtime
- **tags:** skills, templates, harness
- **relates_to:** practice-explicit-harness-flag, map-opencode-harness-adapter, map-codex-harness-adapter, map-claude-skills

## practice-split-practice-and-map

- **kind:** practice
- **title:** Split combined statements into separate practice and map nodes
- **tags:** extraction, prompts, modeling
- **derived_from:** PRD.md, docs/internals/schemas.md, docs/internals/prompts.md

## practice-strict-config-yaml-schema

- **kind:** practice
- **title:** config.yaml schema is strict; unknown keys are a hard error
- **tags:** config, schema, strict
- **derived_from:** PRD.md, docs/cli-reference.md

## practice-zod-validation-at-read

- **kind:** practice
- **title:** Every YAML/JSON shape is validated by Zod at read time
- **tags:** zod, schema, validation
- **derived_from:** docs/internals/schemas.md
