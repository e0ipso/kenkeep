---
schema_version: 1
nodes_hash: 'sha256:f762a78a1f9840316a01d667da41c1662bb9a8af091495a854e5f127c109f78b'
node_count: 45
---
# KB Graph

Total nodes: 45

## map-ai-knowledge-base-package

- **kind:** map
- **title:** @e0ipso/ai-knowledge-base npm package
- **tags:** overview, package, npm
- **relates_to:** map-harness-adapter, map-knowledge-base-directory
- **derived_from:** README.md, docs/index.md, docs/how-it-works.md

## map-bootstrap-incremental-command

- **kind:** map
- **title:** bootstrap-incremental (CLI)
- **tags:** cli, bootstrap, deterministic
- **relates_to:** map-kb-bootstrap-skill, map-bootstrap-state-file, practice-bootstrap-never-overwrites-existing-nodes, practice-dont-run-llm-pipelines-in-ci
- **derived_from:** docs/cli-reference.md, docs/installation.md, docs/daily-use.md

## map-bootstrap-state-file

- **kind:** map
- **title:** .state/bootstrap-state.json (per-doc hash cache)
- **tags:** bootstrap, hash, state, schema
- **relates_to:** map-bootstrap-incremental-command
- **derived_from:** docs/internals/schemas.md, docs/troubleshooting.md

## map-capture-hook

- **kind:** map
- **title:** kb-capture.mjs (capture hook)
- **tags:** hooks, capture
- **relates_to:** map-session-log, practice-recursion-guard-kb-builder-internal
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## map-claude-harness

- **kind:** map
- **title:** Claude Code harness adapter
- **tags:** harness, claude, hooks
- **relates_to:** map-harness-adapter, map-capture-hook, map-proposal-drain-hook, map-session-start-hook
- **derived_from:** docs/installation.md, docs/how-it-works.md, docs/internals/hooks.md

## map-codex-harness

- **kind:** map
- **title:** Codex CLI harness adapter
- **tags:** harness, codex, hooks
- **relates_to:** map-harness-adapter
- **derived_from:** docs/installation.md, docs/installation/codex-toml-hooks-coexistence.md, docs/how-it-works.md

## map-config-yaml

- **kind:** map
- **title:** config.yaml (project settings)
- **tags:** config, settings, model
- **relates_to:** map-curate-command, map-bootstrap-incremental-command, map-proposal-drain-hook
- **derived_from:** docs/cli-reference.md, docs/internals/architecture.md

## map-conflict-files

- **kind:** map
- **title:** Conflict files (conflicts/<run-id>-<n>.md)
- **tags:** conflicts, curator, schema
- **relates_to:** practice-curator-never-auto-resolves-contradictions, map-curator-action
- **derived_from:** docs/internals/schemas.md, docs/how-it-works.md, docs/troubleshooting.md

## map-curate-command

- **kind:** map
- **title:** curate (CLI command + /kb-curate skill)
- **tags:** cli, curate, skill
- **relates_to:** map-curator-action, map-conflict-files, practice-curator-never-auto-resolves-contradictions
- **derived_from:** docs/cli-reference.md, docs/daily-use.md, docs/how-it-works.md

## map-curator-action

- **kind:** map
- **title:** Curator action (add / modify / contradict / drop)
- **tags:** schema, curator, action
- **relates_to:** map-curate-command, map-conflict-files
- **derived_from:** docs/internals/schemas.md, docs/internals/prompts.md

## map-cursor-harness-adapter

- **kind:** map
- **title:** Cursor harness adapter
- **tags:** harness, cursor, hooks
- **relates_to:** map-harness-adapter
- **derived_from:** docs/installation.md, docs/how-it-works.md, https://cursor.com/docs/hooks, https://cursor.com/docs/cli/using

## map-graph-md

- **kind:** map
- **title:** GRAPH.md
- **tags:** graph, deterministic
- **relates_to:** map-index-md, map-node-frontmatter
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md

## map-harness-adapter

- **kind:** map
- **title:** Harness adapter
- **tags:** harness, adapter, claude, codex, cursor, opencode, architecture
- **relates_to:** map-claude-harness, map-codex-harness, map-cursor-harness-adapter, map-opencode-harness, practice-explicit-harness-flag-outside-claude
- **derived_from:** README.md, docs/installation.md, docs/internals/architecture.md, CONTRIBUTING.md

## map-hook-build-pipeline-ts-to-cjs

- **kind:** map
- **title:** Hook build pipeline: TS sources to deployed .cjs bundles
- **tags:** build, hooks, tsup, templates, cjs

## map-index-md

- **kind:** map
- **title:** INDEX.md
- **tags:** index, deterministic, sessionstart
- **relates_to:** map-graph-md, map-session-start-hook, map-nodes-hash
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md, docs/internals/architecture.md

## map-kb-bootstrap-skill

- **kind:** map
- **title:** /kb-bootstrap skill
- **tags:** skill, bootstrap, agent
- **relates_to:** map-bootstrap-incremental-command, practice-bootstrap-never-overwrites-existing-nodes, practice-bootstrap-is-supervised-and-judgmental
- **derived_from:** docs/installation.md, docs/daily-use.md, docs/cli-reference.md

## map-knowledge-base-directory

- **kind:** map
- **title:** .ai/knowledge-base/ directory layout
- **tags:** layout, state, directory
- **relates_to:** map-nodes-directory, map-session-log, map-index-md, map-graph-md, map-state-file, map-bootstrap-state-file, map-config-yaml, map-conflict-files
- **derived_from:** docs/internals/architecture.md, docs/installation.md

## map-node-frontmatter

- **kind:** map
- **title:** Node frontmatter schema
- **tags:** schema, frontmatter, nodes
- **relates_to:** map-nodes-directory, map-index-md, map-graph-md
- **derived_from:** docs/internals/schemas.md

## map-nodes-directory

- **kind:** map
- **title:** nodes/ directory and the two kinds
- **tags:** nodes, practice, map, frontmatter, schema
- **relates_to:** map-node-frontmatter, map-knowledge-base-directory
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md

## map-nodes-hash

- **kind:** map
- **title:** nodes_hash algorithm
- **tags:** hash, deterministic, sha256
- **relates_to:** map-index-md, map-graph-md, practice-determinism-contract
- **derived_from:** docs/internals/schemas.md, docs/internals/architecture.md

## map-opencode-harness

- **kind:** map
- **title:** OpenCode harness adapter
- **tags:** harness, opencode, hooks, plugin
- **relates_to:** map-harness-adapter
- **derived_from:** docs/installation.md, docs/how-it-works.md, README.md

## map-proposal-candidate-schema

- **kind:** map
- **title:** Proposal candidate schema
- **tags:** schema, proposal, candidate
- **relates_to:** map-proposal-drain-hook, map-curator-action
- **derived_from:** docs/internals/schemas.md

## map-proposal-drain-hook

- **kind:** map
- **title:** kb-proposal-drain.mjs (extraction hook)
- **tags:** hooks, extraction, llm, async
- **relates_to:** map-session-log, map-proposal-candidate-schema, practice-recursion-guard-kb-builder-internal
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## map-session-log

- **kind:** map
- **title:** Session log (_sessions/*.md)
- **tags:** session, capture, state, schema
- **relates_to:** map-capture-hook, map-proposal-drain-hook
- **derived_from:** docs/internals/hooks.md, docs/internals/schemas.md, docs/internals/architecture.md

## map-session-start-hook

- **kind:** map
- **title:** kb-session-start.mjs (consume hook)
- **tags:** hooks, consume, sessionstart, index
- **relates_to:** map-index-md, practice-recursion-guard-kb-builder-internal
- **derived_from:** docs/internals/hooks.md, docs/index.md

## map-state-file

- **kind:** map
- **title:** .state/state.json (lock + nudge state)
- **tags:** state, lock, schema
- **relates_to:** map-bootstrap-state-file
- **derived_from:** docs/internals/architecture.md, docs/internals/schemas.md

## practice-adapters-never-cross-directories

- **kind:** practice
- **title:** Adapters never reach into each other's directories
- **tags:** adapter, architecture, isolation
- **relates_to:** map-harness-adapter, practice-no-event-translation-across-adapters
- **derived_from:** CONTRIBUTING.md, docs/internals/architecture.md

## practice-bootstrap-is-supervised-and-judgmental

- **kind:** practice
- **title:** Bootstrap is supervised and judgmental, not exhaustive
- **tags:** bootstrap, supervision, sampling
- **relates_to:** map-kb-bootstrap-skill
- **derived_from:** docs/installation.md, docs/daily-use.md, .claude/skills/kb-bootstrap/SKILL.md

## practice-bootstrap-never-overwrites-existing-nodes

- **kind:** practice
- **title:** Bootstrap never overwrites existing nodes
- **tags:** bootstrap, nodes, safety
- **relates_to:** map-kb-bootstrap-skill, map-bootstrap-incremental-command
- **derived_from:** docs/installation.md, docs/daily-use.md, docs/cli-reference.md, .claude/skills/kb-bootstrap/SKILL.md

## practice-bump-prompt-version-comment

- **kind:** practice
- **title:** Bump the prompt's Version comment on every behavior change
- **tags:** prompts, versioning, audit
- **relates_to:** practice-local-prompt-overrides-fall-back-to-bundled
- **derived_from:** docs/internals/prompts.md, docs/troubleshooting.md, CONTRIBUTING.md

## practice-confidence-default-medium-bootstrap

- **kind:** practice
- **title:** Default bootstrap nodes to confidence: medium
- **tags:** bootstrap, confidence, calibration
- **relates_to:** map-kb-bootstrap-skill, map-node-frontmatter
- **derived_from:** .claude/skills/kb-bootstrap/SKILL.md, docs/internals/schemas.md

## practice-conventional-commits-and-release

- **kind:** practice
- **title:** Conventional Commits drive semantic-release
- **tags:** git, release, conventional-commits
- **derived_from:** CONTRIBUTING.md

## practice-curator-drops-non-productive-candidates

- **kind:** practice
- **title:** Curator drops non-productive and change-oriented candidates
- **tags:** curator, prompts, calibration, anti-pattern
- **relates_to:** map-curator-action, map-proposal-candidate-schema
- **derived_from:** docs/internals/prompts.md

## practice-curator-never-auto-resolves-contradictions

- **kind:** practice
- **title:** Curator never auto-resolves contradictions
- **tags:** curator, conflicts, human-in-the-loop
- **relates_to:** map-conflict-files, map-curator-action, map-curate-command
- **derived_from:** docs/how-it-works.md, docs/daily-use.md, docs/internals/prompts.md, docs/internals/schemas.md

## practice-determinism-contract

- **kind:** practice
- **title:** Determinism contract for INDEX/GRAPH generation
- **tags:** determinism, indexing, testing
- **relates_to:** map-nodes-hash, map-index-md, map-graph-md
- **derived_from:** docs/internals/architecture.md

## practice-dont-run-llm-pipelines-in-ci

- **kind:** practice
- **title:** Don't run curate or bootstrap-incremental in CI
- **tags:** ci, llm, workflow
- **relates_to:** map-curate-command, map-bootstrap-incremental-command
- **derived_from:** docs/installation.md, docs/daily-use.md

## practice-explicit-harness-flag-outside-claude

- **kind:** practice
- **title:** Pass --harness explicitly outside an active harness session
- **tags:** harness, cli, codex, cursor, opencode
- **relates_to:** map-harness-adapter, map-cursor-harness-adapter, map-config-yaml
- **derived_from:** docs/cli-reference.md, docs/installation.md

## practice-init-does-not-install-commit-tooling

- **kind:** practice
- **title:** init does not install husky/lint-staged/secretlint/commitlint
- **tags:** init, install, scope
- **derived_from:** docs/installation.md, docs/cli-reference.md

## practice-lint-naming-rules

- **kind:** practice
- **title:** Node naming: id, filename, and kind must agree
- **tags:** lint, naming, nodes
- **relates_to:** map-nodes-directory, map-node-frontmatter
- **derived_from:** README.md, docs/internals/schemas.md

## practice-local-prompt-overrides-fall-back-to-bundled

- **kind:** practice
- **title:** Local prompt overrides fall back to bundled templates
- **tags:** prompts, customization, override
- **relates_to:** map-config-yaml, map-proposal-drain-hook, map-curate-command, map-bootstrap-incremental-command
- **derived_from:** docs/internals/prompts.md, docs/troubleshooting.md

## practice-no-em-dashes

- **kind:** practice
- **title:** No em dashes anywhere in the project
- **tags:** style, writing, ai-detection

## practice-no-event-translation-across-adapters

- **kind:** practice
- **title:** Don't translate event names across harness adapters
- **tags:** adapter, events, harness
- **relates_to:** map-harness-adapter, map-claude-harness, map-codex-harness, map-opencode-harness
- **derived_from:** CONTRIBUTING.md, docs/internals/architecture.md

## practice-recursion-guard-kb-builder-internal

- **kind:** practice
- **title:** CLI launchers must set KB_BUILDER_INTERNAL=1 on the harness child
- **tags:** recursion, hooks, env
- **relates_to:** map-capture-hook, map-proposal-drain-hook, map-session-start-hook
- **derived_from:** docs/internals/hooks.md, docs/troubleshooting.md

## practice-review-nodes-via-git

- **kind:** practice
- **title:** Review node changes via git
- **tags:** review, git, workflow
- **relates_to:** map-curate-command, map-kb-bootstrap-skill
- **derived_from:** README.md, docs/how-it-works.md, docs/daily-use.md, docs/troubleshooting.md

## practice-strict-schema-version-bump-policy

- **kind:** practice
- **title:** Strict schema-version bump policy: no migrators
- **tags:** schema, versioning, breaking-change
- **relates_to:** map-node-frontmatter
- **derived_from:** CONTRIBUTING.md, docs/internals/schemas.md
