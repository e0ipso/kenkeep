---
schema_version: 1
id: map-knowledge-base-directory
title: ".ai/knowledge-base/ directory layout"
kind: map
tags: [layout, state, directory]
derived_from:
  - docs/internals/architecture.md
  - docs/installation.md
relates_to:
  - map-nodes-directory
  - map-session-log
  - map-index-md
  - map-graph-md
  - map-state-file
  - map-bootstrap-state-file
  - map-config-yaml
  - map-conflict-files
depends_on: []
confidence: high
summary: "Per-repo scaffold at .ai/knowledge-base/: nodes/, INDEX/GRAPH, _sessions/, _logs/, .state/, .config/prompts/, conflicts/."
---

# `.ai/knowledge-base/` directory layout

Created by `init`. Same layout across all three harnesses.

| Path | Purpose |
|---|---|
| `nodes/{practice,map}/` | Canonical knowledge nodes. Reviewed via `git diff`, accepted via `git commit`. |
| `INDEX.md` | Catalog of every node (title, path, tags). Injected into every new session. Regenerated deterministically. |
| `GRAPH.md` | Full edge listing. Not injected; read on demand. Regenerated deterministically. |
| `_sessions/<YYYYMMDD-HHmm-<sessionId>>.md` | Per-session checkpoint (redacted transcript + frontmatter). |
| `_logs/{proposal,curator,bootstrap-incremental}/*.jsonl` | Stream-JSON traces from LLM pipelines. Gitignored. |
| `.state/installed-version` | Package version + selected harnesses. Committed. |
| `.state/state.json` | Lock + `last_nudged_at`. Gitignored. |
| `.state/bootstrap-state.json` | Per-doc SHA-256 cache for bootstrap. Gitignored. |
| `.config/prompts/{proposal-extract,curator,bootstrap-incremental}.md` | Local prompt overrides. Committed. |
| `conflicts/<run-id>-<n>.md` | Curator-detected contradictions, one file per conflict. |
| `config.yaml` | Project settings (committed). |

The package installs a managed block in the repo `.gitignore` for the runtime state files (`_sessions/`, `_logs/`, `state.json`, `bootstrap-state.json`).
