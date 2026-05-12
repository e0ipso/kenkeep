---
schema_version: 1
generated_at: '2026-05-12T11:48:24.258Z'
nodes_hash: 'sha256:ddcdfa366b97c0de528654822a49de0de01595d0d27cf94c4c1cb3380e868b80'
node_count: 28
budget_tokens: 2000
---
# KB Index

_28 nodes • 28 currently valid • 0 superseded • last updated 2026-05-12T11:48:24.258Z_


## Practice (how we build)
- **ai-knowledge-base config is YAML, never JSON** — The ai-knowledge-base config file is always YAML at config.yaml; do not introduce JSON config files or JSON parsing for it. [`nodes/practice/practice-config-yaml-not-json.md`] (tags: config, yaml, ai-knowledge-base)
- **INDEX.md and GRAPH.md regenerate only on curate and pre-commit** — INDEX/GRAPH regen at the end of curate and via lint-staged pre-commit on nodes/ changes; bootstrap never regenerates them. [`nodes/practice/practice-index-graph-regen-on-curate-and-precommit.md`] (tags: kb, index, graph, commit-workflow, lint-staged)
- **Skip CHANGELOG.md and treat IMPLEMENTATION.md as suspect during bootstrap** — Bootstrap skips CHANGELOG.md and never sources a node from IMPLEMENTATION.md alone; verify claims against src/ or current docs. [`nodes/practice/practice-bootstrap-skip-changelog-and-implementation.md`] (tags: bootstrap, kb, docs, scope)
- **No em-dashes or hyphen-as-dash in prose** — Never use `—`, `–`, or ` - ` as a separator in project prose. Use commas, colons, or parentheses instead. [`nodes/practice/practice-no-em-dashes-or-hyphen-as-dash-in-prose.md`] (tags: prose, style, docs, commits)
- **One logical change per PR, with the docs update for that change** — Branch from main. One logical change per PR. Include doc updates for the phase you're touching. Run npm test, typecheck, and lint before pushing. [`nodes/practice/practice-atomic-prs-with-paired-docs.md`] (tags: git, pr, review, docs)
- **Conventional Commits are required: they drive the release** — Releases are automated via semantic-release. Conventional commit messages (feat:, fix:, refactor:, docs:, test:, chore:) determine version and changelog. [`nodes/practice/practice-conventional-commits.md`] (tags: git, releases, commits, semantic-release)
- **The curator's only allowed tool is Read** — The curator subprocess may only use Read against existing nodes. All node writes happen in the wrapper after parsing the curator's JSON output. [`nodes/practice/practice-curator-read-only-tool.md`] (tags: curator, prompts, tools, claude-code)
- **INDEX/GRAPH and nodes_hash are deterministic and content-addressed** — computeNodesHash, generateIndex, generateGraph, slugify, deriveNodeId, and ensureUniqueId are pure. ULID is the only randomness, scoped to run_id minting. [`nodes/practice/practice-determinism-contract.md`] (tags: determinism, hashing, index, graph, testing)
- **Sync hooks must finish in under 1 second** — kb-capture and kb-session-start are sync hooks with a 1s wall-clock deadline. Overruns exit 0 so session startup is never blocked. [`nodes/practice/practice-hooks-meet-1s-deadline.md`] (tags: hooks, performance, claude-code, contract)
- **Never run curate or bootstrap-incremental in CI** — CI validates that what's committed is well-formed; it does not run LLM pipelines. curate and bootstrap-incremental write to nodes/ and need human review. [`nodes/practice/practice-no-llm-pipelines-in-ci.md`] (tags: ci, curate, bootstrap, policy)
- **Strict schema-version policy: clean break, no migrators** — Every on-disk shape carries schema_version: 1. Bumps are a clean break: no migrators, no compat shims, no legacy paths. [`nodes/practice/practice-no-schema-migrators.md`] (tags: schema, versioning, policy, no-legacy)
- **Bump the Version: N comment on every prompt behavior change** — Every shipped prompt file has a Version: N comment. Bump it whenever you change behavior, and note the change in the changelog. [`nodes/practice/practice-prompt-versioning.md`] (tags: prompts, versioning, changelog)

## Map (what exists)
- **.ai/knowledge-base/config.yaml: project-level tunables** — Project config at .ai/knowledge-base/config.yaml; user config at ~/.config/ai-knowledge-base/config.yaml; prompts dir at .ai/knowledge-base/.config/. [`nodes/map/map-project-config-json.md`] (tags: settings, config, tunables, yaml)
- **.state/bootstrap-state.json: per-doc SHA-256 cache for bootstrap** — Per-doc SHA-256 cache at .ai/knowledge-base/.state/bootstrap-state.json; tracks produced nodes and bootstrap timestamps. Gitignored. [`nodes/map/map-bootstrap-state-file.md`] (tags: state, bootstrap, hashing, gitignore)
- **Project documentation layout** — Docs live at repo root (README, CONTRIBUTING, PRD, IMPLEMENTATION, CHANGELOG) plus docs/ (user-facing) and docs/internals/ (developer-facing). [`nodes/map/map-project-documentation-layout.md`] (tags: docs, directory-layout, bootstrap)
- **Adapter interface: src/adapters/types.ts** — Single seam for assistant-specific code. v1 ships adapters/claude.ts only; add an adapter by implementing the methods and dispatching from init.ts. [`nodes/map/map-adapter-interface.md`] (tags: adapters, interface, claude-code, extension-point)
- **ai-knowledge-base CLI: the package binary** — Commander-based CLI. Two shapes: deterministic (init, doctor, status, node add, index rebuild, logs prune) and LLM-invoking (curate, bootstrap-incremental). [`nodes/map/map-ai-knowledge-base-cli.md`] (tags: cli, commander, binary)
- **The three Claude Code hooks registered by init** — init registers three hook scripts in .claude/settings.json: kb-capture (Stop/SessionEnd/PreCompact), kb-stage2-drain (SessionStart async), kb-session-start (SessionStart sync). [`nodes/map/map-claude-hooks.md`] (tags: hooks, claude-code, capture, extract, consume)
- **INDEX.md and GRAPH.md: deterministic outputs derived from nodes/** — INDEX.md is the token-budgeted view injected into every new session. GRAPH.md is the full edge listing, read on demand. Both regenerated from nodes/ with no LLM. [`nodes/map/map-index-and-graph-files.md`] (tags: index, graph, deterministic, generated)
- **Claude Code skills: /kb-curate, /kb-add, /kb-bootstrap** — init --assistants claude installs three skills. /kb-curate and /kb-add map to CLI subcommands; /kb-bootstrap is agent-driven only and has no CLI equivalent. [`nodes/map/map-kb-claude-skills.md`] (tags: skills, claude-code, curate, add, bootstrap)
- **Map node: what-exists, named entities and vocabulary** — A map node captures named things that exist in the project: modules, services, vocabulary, file-tree locations. Stored under nodes/map/. [`nodes/map/map-map-node.md`] (tags: vocabulary, node-kind, map)
- **nodes/: the canonical knowledge tree** — The committed knowledge tree at .ai/knowledge-base/nodes/{practice,map}/. Curator, node add, bootstrap, and humans all write here; review is git diff; acceptance is git commit. [`nodes/map/map-nodes-directory.md`] (tags: storage, nodes, canonical, git)
- **.state/pending-conflicts.json: curator-detected contradictions** — The curator records contradict actions here instead of writing conflicting nodes. The /kb-curate skill reads this file after the curator exits and walks each entry with the user. [`nodes/map/map-pending-conflicts-file.md`] (tags: state, curator, contradictions, kb-curate)
- **Practice node: how-we-build, imperative guidance** — A practice node captures imperative project guidance: conventions, prohibitions, gotchas, decision rationale, tooling. Stored under nodes/practice/. [`nodes/map/map-practice-node.md`] (tags: vocabulary, node-kind, practice)
- **_sessions/: captured session logs (gitignored by default)** — Per-session redacted transcript slices live at .ai/knowledge-base/_sessions/<YYYYMMDD-HHmm-id>.md. Gitignored by default; commit only if reviewers need provenance. [`nodes/map/map-sessions-directory.md`] (tags: storage, capture, sessions, gitignore)

_3 additional nodes hidden by token budget — see GRAPH.md_
