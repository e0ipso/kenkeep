---
schema_version: 1
nodes_hash: 'sha256:cf49e02b152339459167ac04c4cc778cd86d802985efe236313e9bcaa8ec8d74'
node_count: 40
---
# KB Graph

Total nodes: 40

## map-ai-knowledge-base-cli

- **kind:** map
- **title:** ai-knowledge-base CLI: the package binary
- **tags:** cli, commander, binary
- **relates_to:** map-kb-claude-skills
- **derived_from:** docs/cli-reference.md, docs/internals/architecture.md

## map-bootstrap-state-file

- **kind:** map
- **title:** .state/bootstrap-state.json: per-doc SHA-256 cache for bootstrap
- **tags:** state, bootstrap, hashing, gitignore
- **relates_to:** practice-bootstrap-skip-changelog-and-implementation
- **derived_from:** 20260512-0959-f963bf78b135.md

## map-build-templates-script

- **kind:** map
- **title:** scripts/build-templates.mjs: regenerates templates/ from sources
- **tags:** build, templates, script
- **relates_to:** map-templates-npm-artifact, practice-do-not-commit-bundled-output
- **derived_from:** 20260512-1439-722a03fa9cbe.md

## map-claude-hooks

- **kind:** map
- **title:** The three Claude Code hooks registered by init
- **tags:** hooks, claude-code, capture, extract, consume
- **relates_to:** practice-hooks-meet-1s-deadline, practice-recursion-guard-env-var
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## map-dedup-cache

- **kind:** map
- **title:** dedup-cache: sha256-of-slice cache with 5-minute TTL
- **tags:** dedup, kb-pipeline, cache
- **relates_to:** map-kb-capture-hook, practice-one-session-log-per-session-id
- **derived_from:** 20260512-1438-e5b4618a5295.md

## map-dogfood-claude-hooks-output

- **kind:** map
- **title:** .claude/hooks/*.mjs: this repo's own init output (dogfooding)
- **tags:** dogfooding, hooks, claude
- **relates_to:** map-templates-npm-artifact, map-claude-hooks, practice-do-not-commit-bundled-output
- **derived_from:** 20260512-1439-722a03fa9cbe.md

## map-index-and-graph-files

- **kind:** map
- **title:** INDEX.md and GRAPH.md: deterministic outputs derived from nodes/
- **tags:** index, graph, deterministic, generated
- **relates_to:** map-nodes-directory, practice-determinism-contract
- **derived_from:** docs/how-it-works.md, docs/internals/architecture.md, docs/internals/schemas.md

## map-kb-capture-hook

- **kind:** map
- **title:** kb-capture hook: writes session logs on Stop/SessionEnd/PreCompact
- **tags:** hook, capture, kb-pipeline
- **relates_to:** map-claude-hooks, map-dedup-cache, map-session-log-and-queue-helpers
- **derived_from:** 20260512-1438-e5b4618a5295.md

## map-kb-claude-skills

- **kind:** map
- **title:** Claude Code skills: /kb-curate, /kb-add, /kb-bootstrap
- **tags:** skills, claude-code, curate, add, bootstrap
- **relates_to:** map-ai-knowledge-base-cli, map-pending-conflicts-file
- **derived_from:** docs/cli-reference.md, docs/daily-use.md, PRD.md

## map-kb-proposal-drain

- **kind:** map
- **title:** kb-proposal-drain: async worker that runs the extraction step
- **tags:** worker, proposal, kb-pipeline
- **relates_to:** map-claude-hooks
- **derived_from:** 20260512-1438-e5b4618a5295.md, 20260512-1527-aa21a0a11614.md

## map-map-node

- **kind:** map
- **title:** Map node: what-exists, named entities and vocabulary
- **tags:** vocabulary, node-kind, map
- **relates_to:** map-practice-node, map-nodes-directory
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md, PRD.md

## map-nodes-directory

- **kind:** map
- **title:** nodes/: the canonical knowledge tree
- **tags:** storage, nodes, canonical, git
- **relates_to:** map-practice-node, map-map-node, map-index-and-graph-files
- **derived_from:** docs/how-it-works.md, docs/internals/architecture.md

## map-pending-conflicts-file

- **kind:** map
- **title:** .state/pending-conflicts.json: curator-detected contradictions
- **tags:** state, curator, contradictions, kb-curate
- **relates_to:** map-claude-hooks, map-kb-claude-skills, practice-curator-read-only-tool
- **derived_from:** docs/internals/schemas.md, docs/how-it-works.md

## map-practice-node

- **kind:** map
- **title:** Practice node: how-we-build, imperative guidance
- **tags:** vocabulary, node-kind, practice
- **relates_to:** map-map-node, map-nodes-directory
- **derived_from:** docs/how-it-works.md, docs/internals/schemas.md, PRD.md

## map-project-config-json

- **kind:** map
- **title:** .ai/knowledge-base/config.yaml: project-level tunables
- **tags:** settings, config, tunables, yaml
- **relates_to:** practice-config-yaml-not-json
- **derived_from:** 20260512-1009-937d05692312.md

## map-project-documentation-layout

- **kind:** map
- **title:** Project documentation layout
- **tags:** docs, directory-layout, bootstrap
- **relates_to:** practice-bootstrap-skip-changelog-and-implementation
- **derived_from:** 20260512-0959-f963bf78b135.md

## map-proposal-artifact

- **kind:** map
- **title:** Proposal: structured candidate nodes extracted from a Transcript
- **tags:** kb-pipeline, artifact, vocabulary
- **relates_to:** map-transcript-artifact, map-kb-proposal-drain
- **derived_from:** 20260512-1527-aa21a0a11614.md

## map-session-log-and-queue-helpers

- **kind:** map
- **title:** session-log and queue helpers in src/lib
- **tags:** module, kb-pipeline, helpers
- **relates_to:** map-kb-capture-hook, practice-one-session-log-per-session-id
- **derived_from:** 20260512-1438-e5b4618a5295.md

## map-sessions-directory

- **kind:** map
- **title:** _sessions/: captured session logs (gitignored by default)
- **tags:** storage, capture, sessions, gitignore
- **relates_to:** map-claude-hooks, map-nodes-directory
- **derived_from:** docs/internals/architecture.md, docs/internals/schemas.md, PRD.md

## map-state-json-file

- **kind:** map
- **title:** .state/state.json: lock and nudge timestamp
- **tags:** state, lock, nudge, gitignore
- **relates_to:** map-claude-hooks
- **derived_from:** docs/internals/schemas.md, docs/internals/architecture.md

## map-templates-npm-artifact

- **kind:** map
- **title:** templates/: shipped npm artifact, regenerated on publish
- **tags:** npm, publish, artifact
- **relates_to:** map-build-templates-script, practice-do-not-commit-bundled-output
- **derived_from:** 20260512-1439-722a03fa9cbe.md

## map-transcript-artifact

- **kind:** map
- **title:** Transcript: raw session capture in the KB pipeline
- **tags:** kb-pipeline, artifact, vocabulary
- **relates_to:** map-proposal-artifact, map-sessions-directory
- **derived_from:** 20260512-1527-aa21a0a11614.md

## practice-atomic-prs-with-paired-docs

- **kind:** practice
- **title:** One logical change per PR, with the docs update for that change
- **tags:** git, pr, review, docs
- **derived_from:** CONTRIBUTING.md

## practice-bootstrap-skip-changelog-and-implementation

- **kind:** practice
- **title:** Skip CHANGELOG.md and treat IMPLEMENTATION.md as suspect during bootstrap
- **tags:** bootstrap, kb, docs, scope
- **relates_to:** map-project-documentation-layout, practice-no-schema-migrators
- **derived_from:** 20260512-0959-f963bf78b135.md

## practice-config-yaml-not-json

- **kind:** practice
- **title:** ai-knowledge-base config is YAML, never JSON
- **tags:** config, yaml, ai-knowledge-base
- **relates_to:** map-project-config-json
- **derived_from:** 20260512-1009-937d05692312.md

## practice-conventional-commits

- **kind:** practice
- **title:** Conventional Commits are required: they drive the release
- **tags:** git, releases, commits, semantic-release
- **derived_from:** CONTRIBUTING.md

## practice-curator-read-only-tool

- **kind:** practice
- **title:** The curator's only allowed tool is Read
- **tags:** curator, prompts, tools, claude-code
- **derived_from:** docs/internals/prompts.md

## practice-determinism-contract

- **kind:** practice
- **title:** INDEX/GRAPH and nodes_hash are deterministic and content-addressed
- **tags:** determinism, hashing, index, graph, testing
- **relates_to:** map-index-and-graph-files, map-nodes-directory
- **derived_from:** docs/internals/architecture.md, docs/internals/schemas.md

## practice-do-not-commit-bundled-output

- **kind:** practice
- **title:** Don't commit bundled/generated output to the repo
- **tags:** build-output, gitignore, repo-hygiene
- **relates_to:** map-build-templates-script, map-templates-npm-artifact, map-dogfood-claude-hooks-output
- **derived_from:** 20260512-1439-722a03fa9cbe.md

## practice-hooks-meet-1s-deadline

- **kind:** practice
- **title:** Sync hooks must finish in under 1 second
- **tags:** hooks, performance, claude-code, contract
- **relates_to:** map-claude-hooks
- **derived_from:** docs/internals/hooks.md, docs/internals/manual-test-plan.md

## practice-index-graph-regen-on-curate-and-precommit

- **kind:** practice
- **title:** INDEX.md and GRAPH.md regenerate only on curate and pre-commit
- **tags:** kb, index, graph, commit-workflow, lint-staged
- **relates_to:** map-index-and-graph-files, practice-determinism-contract, practice-no-llm-pipelines-in-ci
- **derived_from:** 20260512-0959-f963bf78b135.md

## practice-no-em-dashes-or-hyphen-as-dash-in-prose

- **kind:** practice
- **title:** No em-dashes or hyphen-as-dash in prose
- **tags:** prose, style, docs, commits

## practice-no-llm-pipelines-in-ci

- **kind:** practice
- **title:** Never run curate or bootstrap-incremental in CI
- **tags:** ci, curate, bootstrap, policy
- **relates_to:** map-ai-knowledge-base-cli
- **derived_from:** docs/daily-use.md

## practice-no-schema-migrators

- **kind:** practice
- **title:** Strict schema-version policy: clean break, no migrators
- **tags:** schema, versioning, policy, no-legacy
- **relates_to:** map-zod-schemas
- **derived_from:** CONTRIBUTING.md

## practice-one-session-log-per-session-id

- **kind:** practice
- **title:** One session log per session_id, not per assistant turn
- **tags:** kb-capture, session-log, hooks, dedup
- **relates_to:** map-kb-capture-hook, map-dedup-cache, map-session-log-and-queue-helpers
- **derived_from:** 20260512-1438-e5b4618a5295.md

## practice-prompt-versioning

- **kind:** practice
- **title:** Bump the Version: N comment on every prompt behavior change
- **tags:** prompts, versioning, changelog
- **derived_from:** CONTRIBUTING.md, docs/internals/prompts.md

## practice-recursion-guard-env-var

- **kind:** practice
- **title:** Set KB_BUILDER_INTERNAL=1 on every internal claude -p subprocess
- **tags:** hooks, recursion, env-vars, claude-code
- **relates_to:** map-claude-hooks
- **derived_from:** docs/internals/hooks.md, docs/internals/architecture.md

## practice-sessions-and-proposal-logs-are-intermediate-artifacts

- **kind:** practice
- **title:** Session logs and extraction logs are intermediate artifacts, safe to wipe
- **tags:** cleanup, kb-pipeline, intermediate-artifacts
- **relates_to:** map-sessions-directory, map-nodes-directory
- **derived_from:** 20260512-1438-e5b4618a5295.md

## practice-v1-claude-code-only

- **kind:** practice
- **title:** v1 supports Claude Code only
- **tags:** scope, claude-code, v1
- **derived_from:** PRD.md, docs/internals/architecture.md

## practice-verify-shipped-artifact-before-delete

- **kind:** practice
- **title:** Verify shipped-artifact status before deleting tracked files
- **tags:** safety, destructive-actions, verification
- **relates_to:** practice-do-not-commit-bundled-output, map-templates-npm-artifact
- **derived_from:** 20260512-1439-722a03fa9cbe.md
