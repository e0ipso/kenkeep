---
schema_version: 2
nodes_hash: 'sha256:aa5ac264481a900eda5294fde3f0d3cf2f5cdc5ee43d6fd13fdf90db491ab29b'
node_count: 57
---
# kenkeep Graph

Total nodes: 57

## map-bootstrap-incremental-command

- **kind:** map
- **title:** bootstrap-incremental (CLI)
- **path:** bootstrap/map-bootstrap-incremental-command.md
- **tags:** cli, bootstrap, deterministic
- **relates_to:** map-kk-bootstrap-skill, map-bootstrap-state-file, practice-bootstrap-never-overwrites-existing-nodes, practice-dont-run-llm-pipelines-in-ci
- **derived_from:** docs/cli-reference.md, docs/installation.md, docs/daily-use.md

## map-bootstrap-state-file

- **kind:** map
- **title:** .state/bootstrap-state.json (per-doc hash cache)
- **path:** bootstrap/map-bootstrap-state-file.md
- **tags:** bootstrap, hash, state, schema
- **relates_to:** map-bootstrap-incremental-command
- **derived_from:** docs/internals/schemas.md, docs/troubleshooting.md

## map-capture-hook

- **kind:** map
- **title:** kk-capture.mjs (capture hook)
- **path:** hooks/map-capture-hook.md
- **tags:** hooks, capture
- **relates_to:** map-session-log, practice-recursion-guard-kenkeep-builder-internal
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## map-claude-harness

- **kind:** map
- **title:** Claude Code harness adapter
- **path:** harness/map-claude-harness.md
- **tags:** harness, claude, hooks
- **relates_to:** map-harness-adapter, map-capture-hook, map-proposal-drain-hook, map-session-start-hook
- **derived_from:** docs/installation.md, docs/how-it-works.md, docs/internals/hooks.md

## map-codex-harness

- **kind:** map
- **title:** Codex CLI harness adapter
- **path:** harness/map-codex-harness.md
- **tags:** harness, codex, hooks
- **relates_to:** map-harness-adapter
- **derived_from:** docs/installation.md, docs/installation/codex-toml-hooks-coexistence.md, docs/how-it-works.md

## map-config-yaml

- **kind:** map
- **title:** config.yaml (project settings)
- **path:** knowledge-base/state/map-config-yaml.md
- **tags:** config, settings, model
- **relates_to:** map-curate-command, map-bootstrap-incremental-command, map-proposal-drain-hook
- **derived_from:** docs/cli-reference.md, docs/internals/architecture.md

## map-conflict-files

- **kind:** map
- **title:** Conflict files (conflicts/<run-id>-<n>.md)
- **path:** curation/map-conflict-files.md
- **tags:** conflicts, curator, schema
- **relates_to:** practice-curator-never-auto-resolves-contradictions, map-curator-action
- **derived_from:** docs/internals/schemas.md, docs/how-it-works.md, docs/troubleshooting.md

## map-copilot-harness-adapter

- **kind:** map
- **title:** Copilot harness adapter
- **path:** harness/map-copilot-harness-adapter.md
- **tags:** harness, copilot, hooks, adapter
- **relates_to:** map-harness-adapter, map-codex-harness, map-opencode-harness, map-cursor-harness-adapter
- **derived_from:** docs/installation.md, docs/how-it-works.md, https://github.com/github/copilot-cli, https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference

## map-curate-cli-conflict-resolution-output-message

- **kind:** map
- **title:** curate CLI conflict-resolution output message
- **path:** curation/map-curate-cli-conflict-resolution-output-message.md
- **tags:** cli, curate, conflicts, output
- **relates_to:** map-curate-command, map-conflict-files

## map-curate-command

- **kind:** map
- **title:** curate (CLI command + /kk-curate skill)
- **path:** curation/map-curate-command.md
- **tags:** cli, curate, skill
- **relates_to:** map-curator-action, map-conflict-files, practice-curator-never-auto-resolves-contradictions
- **derived_from:** docs/cli-reference.md, docs/daily-use.md, docs/how-it-works.md

## map-curator-action

- **kind:** map
- **title:** Curator action (add / modify / contradict / drop)
- **path:** curation/map-curator-action.md
- **tags:** schema, curator, action
- **relates_to:** map-curate-command, map-conflict-files
- **derived_from:** docs/internals/schemas.md, docs/internals/prompts.md

## map-cursor-harness-adapter

- **kind:** map
- **title:** Cursor harness adapter
- **path:** harness/map-cursor-harness-adapter.md
- **tags:** harness, cursor, hooks
- **relates_to:** map-harness-adapter
- **derived_from:** docs/installation.md, docs/how-it-works.md, https://cursor.com/docs/hooks, https://cursor.com/docs/cli/using

## map-entry-md

- **kind:** map
- **title:** ENTRY.md
- **path:** knowledge-base/index/map-entry-md.md
- **tags:** entry, index, deterministic, sessionstart
- **relates_to:** map-graph-md, map-session-start-hook, map-nodes-hash
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md, docs/internals/architecture.md

## map-graph-md

- **kind:** map
- **title:** GRAPH.md
- **path:** knowledge-base/index/map-graph-md.md
- **tags:** graph, deterministic
- **relates_to:** map-entry-md, map-node-frontmatter
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md

## map-harness-adapter

- **kind:** map
- **title:** Harness adapter
- **path:** harness/map-harness-adapter.md
- **tags:** harness, adapter, claude, codex, cursor, opencode, copilot, architecture
- **relates_to:** map-claude-harness, map-codex-harness, map-cursor-harness-adapter, map-opencode-harness, map-copilot-harness-adapter, practice-explicit-harness-flag-outside-claude
- **derived_from:** README.md, docs/installation.md, docs/internals/architecture.md, CONTRIBUTING.md

## map-hook-build-pipeline-ts-to-cjs

- **kind:** map
- **title:** Hook build pipeline: TS sources to deployed .cjs bundles
- **path:** hooks/map-hook-build-pipeline-ts-to-cjs.md
- **tags:** build, hooks, tsup, templates, cjs

## map-kenkeep-directory

- **kind:** map
- **title:** .ai/kenkeep/ directory layout
- **path:** knowledge-base/map-kenkeep-directory.md
- **tags:** layout, state, directory
- **relates_to:** map-nodes-directory, map-session-log, map-entry-md, map-graph-md, map-state-file, map-bootstrap-state-file, map-config-yaml, map-conflict-files
- **derived_from:** docs/internals/architecture.md, docs/installation.md

## map-kenkeep-package

- **kind:** map
- **title:** kenkeep npm package
- **path:** knowledge-base/map-kenkeep-package.md
- **tags:** overview, package, npm
- **relates_to:** map-harness-adapter, map-kenkeep-directory
- **derived_from:** README.md, docs/index.md, docs/how-it-works.md

## map-kk-bootstrap-skill

- **kind:** map
- **title:** /kk-bootstrap skill
- **path:** bootstrap/map-kk-bootstrap-skill.md
- **tags:** skill, bootstrap, agent
- **relates_to:** map-bootstrap-incremental-command, practice-bootstrap-never-overwrites-existing-nodes, practice-bootstrap-is-supervised-and-judgmental
- **derived_from:** docs/installation.md, docs/daily-use.md, docs/cli-reference.md

## map-node-frontmatter

- **kind:** map
- **title:** Node frontmatter schema
- **path:** knowledge-base/nodes/map-node-frontmatter.md
- **tags:** schema, frontmatter, nodes
- **relates_to:** map-nodes-directory, map-entry-md, map-graph-md
- **derived_from:** docs/internals/schemas.md

## map-nodes-directory

- **kind:** map
- **title:** nodes/ directory and the two kinds
- **path:** knowledge-base/nodes/map-nodes-directory.md
- **tags:** nodes, practice, map, frontmatter, schema
- **relates_to:** map-node-frontmatter, map-kenkeep-directory
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md

## map-nodes-hash

- **kind:** map
- **title:** nodes_hash algorithm
- **path:** knowledge-base/index/map-nodes-hash.md
- **tags:** hash, deterministic, sha256
- **relates_to:** map-entry-md, map-graph-md, practice-determinism-contract
- **derived_from:** docs/internals/schemas.md, docs/internals/architecture.md

## map-opencode-harness

- **kind:** map
- **title:** OpenCode harness adapter
- **path:** harness/map-opencode-harness.md
- **tags:** harness, opencode, hooks, plugin
- **relates_to:** map-harness-adapter
- **derived_from:** docs/installation.md, docs/how-it-works.md, README.md

## map-proposal-candidate-schema

- **kind:** map
- **title:** Proposal candidate schema
- **path:** curation/map-proposal-candidate-schema.md
- **tags:** schema, proposal, candidate
- **relates_to:** map-proposal-drain-hook, map-curator-action
- **derived_from:** docs/internals/schemas.md

## map-proposal-drain-hook

- **kind:** map
- **title:** kk-proposal-drain (extraction hook)
- **path:** hooks/map-proposal-drain-hook.md
- **tags:** hooks, extraction, llm, async, claude, billing
- **relates_to:** map-session-log, map-proposal-candidate-schema, practice-recursion-guard-kenkeep-builder-internal, map-curate-command, map-claude-harness, map-codex-harness, map-cursor-harness-adapter, map-opencode-harness
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## map-session-log

- **kind:** map
- **title:** Session log (_sessions/*.md)
- **path:** knowledge-base/state/map-session-log.md
- **tags:** session, capture, state, schema
- **relates_to:** map-capture-hook, map-proposal-drain-hook
- **derived_from:** docs/internals/hooks.md, docs/internals/schemas.md, docs/internals/architecture.md

## map-session-start-hook

- **kind:** map
- **title:** kk-session-start.mjs (consume hook)
- **path:** hooks/map-session-start-hook.md
- **tags:** hooks, consume, sessionstart, index
- **relates_to:** map-entry-md, practice-recursion-guard-kenkeep-builder-internal
- **derived_from:** docs/internals/hooks.md, docs/index.md

## map-state-file

- **kind:** map
- **title:** .state/state.json (lock + nudge state)
- **path:** knowledge-base/state/map-state-file.md
- **tags:** state, lock, schema
- **relates_to:** map-bootstrap-state-file
- **derived_from:** docs/internals/architecture.md, docs/internals/schemas.md

## map-update-agents-md-kk-index-pointer-injection-into-agents-md

- **kind:** map
- **title:** updateAgentsMd - kk index pointer injection into AGENTS.md
- **path:** cli/map-update-agents-md-kk-index-pointer-injection-into-agents-md.md
- **tags:** init, upgrade, agents-md, markers, index
- **relates_to:** map-entry-md, practice-init-does-not-install-commit-tooling

## practice-adapters-never-cross-directories

- **kind:** practice
- **title:** Adapters never reach into each other's directories
- **path:** harness/practice-adapters-never-cross-directories.md
- **tags:** adapter, architecture, isolation
- **relates_to:** map-harness-adapter, practice-no-event-translation-across-adapters
- **derived_from:** CONTRIBUTING.md, docs/internals/architecture.md

## practice-bootstrap-is-supervised-and-judgmental

- **kind:** practice
- **title:** Bootstrap is supervised and judgmental, not exhaustive
- **path:** bootstrap/practice-bootstrap-is-supervised-and-judgmental.md
- **tags:** bootstrap, supervision, sampling
- **relates_to:** map-kk-bootstrap-skill
- **derived_from:** docs/installation.md, docs/daily-use.md, .claude/skills/kk-bootstrap/SKILL.md

## practice-bootstrap-never-overwrites-existing-nodes

- **kind:** practice
- **title:** Bootstrap never overwrites existing nodes
- **path:** bootstrap/practice-bootstrap-never-overwrites-existing-nodes.md
- **tags:** bootstrap, nodes, safety
- **relates_to:** map-kk-bootstrap-skill, map-bootstrap-incremental-command
- **derived_from:** docs/installation.md, docs/daily-use.md, docs/cli-reference.md, .claude/skills/kk-bootstrap/SKILL.md

## practice-bump-prompt-version-comment

- **kind:** practice
- **title:** Bump the prompt's Version comment on every behavior change
- **path:** prompts/practice-bump-prompt-version-comment.md
- **tags:** prompts, versioning, audit
- **relates_to:** practice-local-prompt-overrides-fall-back-to-bundled
- **derived_from:** docs/internals/prompts.md, docs/troubleshooting.md, CONTRIBUTING.md

## practice-confidence-default-medium-bootstrap

- **kind:** practice
- **title:** Default bootstrap nodes to confidence: medium
- **path:** bootstrap/practice-confidence-default-medium-bootstrap.md
- **tags:** bootstrap, confidence, calibration
- **relates_to:** map-kk-bootstrap-skill, map-node-frontmatter
- **derived_from:** .claude/skills/kk-bootstrap/SKILL.md, docs/internals/schemas.md

## practice-conventional-commits-and-release

- **kind:** practice
- **title:** Conventional Commits drive semantic-release
- **path:** conventions/practice-conventional-commits-and-release.md
- **tags:** git, release, conventional-commits
- **derived_from:** CONTRIBUTING.md

## practice-curate-cli-conflict-output-names-the-three-resolution-outcomes

- **kind:** practice
- **title:** Curate CLI conflict output names the three resolution outcomes
- **path:** curation/practice-curate-cli-conflict-output-names-the-three-resolution-outcomes.md
- **tags:** kenkeep, kk-curate, conflicts, cli, ux
- **relates_to:** map-curate-command, map-conflict-files, practice-curator-never-auto-resolves-contradictions

## practice-curator-drops-non-productive-candidates

- **kind:** practice
- **title:** Curator drops non-productive and change-oriented candidates
- **path:** curation/practice-curator-drops-non-productive-candidates.md
- **tags:** curator, prompts, calibration, anti-pattern
- **relates_to:** map-curator-action, map-proposal-candidate-schema
- **derived_from:** docs/internals/prompts.md

## practice-curator-never-auto-resolves-contradictions

- **kind:** practice
- **title:** Curator never auto-resolves contradictions
- **path:** curation/practice-curator-never-auto-resolves-contradictions.md
- **tags:** curator, conflicts, human-in-the-loop
- **relates_to:** map-conflict-files, map-curator-action, map-curate-command
- **derived_from:** docs/how-it-works.md, docs/daily-use.md, docs/internals/prompts.md, docs/internals/schemas.md

## practice-cursor-sessionstart-additional-context-is-silently-dropped

- **kind:** practice
- **title:** Cursor sessionStart additional_context is silently dropped
- **path:** harness/practice-cursor-sessionstart-additional-context-is-silently-dropped.md
- **tags:** cursor, harness, hooks, gotcha, context-injection
- **relates_to:** map-cursor-harness-adapter

## practice-determinism-contract

- **kind:** practice
- **title:** Determinism contract for ENTRY/GRAPH generation
- **path:** knowledge-base/index/practice-determinism-contract.md
- **tags:** determinism, indexing, testing
- **relates_to:** map-nodes-hash, map-entry-md, map-graph-md
- **derived_from:** docs/internals/architecture.md

## practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents

- **kind:** practice
- **title:** Do not justify scope decisions by current-snapshot file contents
- **path:** conventions/practice-do-not-justify-scope-decisions-by-current-snapshot-file-contents.md
- **tags:** yagni, assumptions, verification

## practice-document-model-recommendations-with-harness-agnostic-framing-2

- **kind:** practice
- **title:** Avoid harness favoritism in examples and recommendations
- **path:** conventions/practice-document-model-recommendations-with-harness-agnostic-framing-2.md
- **tags:** documentation, harness, models, recommendations, examples, configuration
- **relates_to:** map-config-yaml

## practice-dont-run-llm-pipelines-in-ci

- **kind:** practice
- **title:** Don't run curate or bootstrap-incremental in CI
- **path:** conventions/practice-dont-run-llm-pipelines-in-ci.md
- **tags:** ci, llm, workflow
- **relates_to:** map-curate-command, map-bootstrap-incremental-command
- **derived_from:** docs/installation.md, docs/daily-use.md

## practice-explicit-harness-flag-outside-claude

- **kind:** practice
- **title:** Pass --harness explicitly outside an active harness session
- **path:** harness/practice-explicit-harness-flag-outside-claude.md
- **tags:** harness, cli, codex, cursor, opencode
- **relates_to:** map-harness-adapter, map-cursor-harness-adapter, map-config-yaml
- **derived_from:** docs/cli-reference.md, docs/installation.md

## practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters

- **kind:** practice
- **title:** Hook behavior changes must be applied to all four harness adapters
- **path:** harness/practice-hook-behavior-changes-must-be-applied-to-all-four-harness-adapters.md
- **tags:** harness, hooks, architecture, drift

## practice-hook-status-messages-include-kk-prefix-after-emoji

- **kind:** practice
- **title:** Hook status messages include kk prefix after emoji
- **path:** hooks/practice-hook-status-messages-include-kk-prefix-after-emoji.md
- **tags:** hooks, messaging, ux
- **relates_to:** map-capture-hook, map-session-start-hook, map-proposal-drain-hook, map-claude-harness

## practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md

- **kind:** practice
- **title:** init and upgrade inject a static kk index pointer into AGENTS.md
- **path:** cli/practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md.md
- **tags:** init, upgrade, agents-md, index, markers
- **relates_to:** map-entry-md, map-session-start-hook

## practice-init-does-not-install-commit-tooling

- **kind:** practice
- **title:** init does not install husky/lint-staged/secretlint/commitlint
- **path:** cli/practice-init-does-not-install-commit-tooling.md
- **tags:** init, install, scope
- **derived_from:** docs/installation.md, docs/cli-reference.md

## practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx

- **kind:** practice
- **title:** Inside the kenkeep source repo, run the CLI from dist/, not via npx
- **path:** cli/practice-inside-the-kenkeep-source-repo-run-the-cli-from-dist-not-via-npx.md
- **tags:** kenkeep, kk-curate, repo-local, npx, cli
- **relates_to:** map-curate-command, map-kenkeep-package

## practice-lint-naming-rules

- **kind:** practice
- **title:** Node naming: id, filename, and kind must agree
- **path:** knowledge-base/nodes/practice-lint-naming-rules.md
- **tags:** lint, naming, nodes
- **relates_to:** map-nodes-directory, map-node-frontmatter
- **derived_from:** README.md, docs/internals/schemas.md

## practice-local-prompt-overrides-fall-back-to-bundled

- **kind:** practice
- **title:** Local prompt overrides fall back to bundled templates
- **path:** prompts/practice-local-prompt-overrides-fall-back-to-bundled.md
- **tags:** prompts, customization, override
- **relates_to:** map-config-yaml, map-proposal-drain-hook, map-curate-command, map-bootstrap-incremental-command
- **derived_from:** docs/internals/prompts.md, docs/troubleshooting.md

## practice-no-em-dashes

- **kind:** practice
- **title:** No em dashes anywhere in the project
- **path:** conventions/practice-no-em-dashes.md
- **tags:** style, writing, ai-detection

## practice-no-event-translation-across-adapters

- **kind:** practice
- **title:** Don't translate event names across harness adapters
- **path:** harness/practice-no-event-translation-across-adapters.md
- **tags:** adapter, events, harness
- **relates_to:** map-harness-adapter, map-claude-harness, map-codex-harness, map-opencode-harness
- **derived_from:** CONTRIBUTING.md, docs/internals/architecture.md

## practice-recursion-guard-kenkeep-builder-internal

- **kind:** practice
- **title:** CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child
- **path:** hooks/practice-recursion-guard-kenkeep-builder-internal.md
- **tags:** recursion, hooks, env
- **relates_to:** map-capture-hook, map-proposal-drain-hook, map-session-start-hook
- **derived_from:** docs/internals/hooks.md, docs/troubleshooting.md

## practice-review-nodes-via-git

- **kind:** practice
- **title:** Review node changes via git
- **path:** knowledge-base/nodes/practice-review-nodes-via-git.md
- **tags:** review, git, workflow
- **relates_to:** map-curate-command, map-kk-bootstrap-skill
- **derived_from:** README.md, docs/how-it-works.md, docs/daily-use.md, docs/troubleshooting.md

## practice-strict-schema-version-bump-policy

- **kind:** practice
- **title:** Strict schema-version bump policy
- **path:** knowledge-base/nodes/practice-strict-schema-version-bump-policy.md
- **tags:** schema, versioning, breaking-change
- **relates_to:** map-node-frontmatter
- **derived_from:** CONTRIBUTING.md, docs/internals/schemas.md

## practice-testing-philosophy-few-tests-mostly-integration

- **kind:** practice
- **title:** Testing philosophy: few tests, mostly integration
- **path:** conventions/practice-testing-philosophy-few-tests-mostly-integration.md
- **tags:** testing, philosophy, integration-tests, coverage
