---
type: map
title: .ai/kenkeep/ directory layout
description: >-
  Per-repo scaffold at .ai/kenkeep/: nodes/, ENTRY/GRAPH, _sessions/, _logs/,
  .state/, .config/prompts/, conflicts/.
tags:
  - layout
  - state
  - directory
kk_schema_version: 3
kk_id: map-kenkeep-directory
kk_derived_from:
  - docs/internals/architecture.md
  - docs/installation.md
kk_relates_to:
  - map-nodes-directory
  - map-session-log
  - map-entry-md
  - map-graph-md
  - map-state-file
  - map-bootstrap-state-file
  - map-config-yaml
  - map-conflict-files
kk_depends_on: []
kk_confidence: high
---

# `.ai/kenkeep/` directory layout

Created by `init`. Same layout across all five harnesses.

| Path | Purpose |
|---|---|
| `nodes/` (nested topical folders) | Canonical knowledge nodes. Reviewed via `git diff`, accepted via `git commit`. |
| `ENTRY.md` | Entry catalog: whole-tree totals + top-level branch list. Injected into every new session. Regenerated deterministically. |
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

<!-- kk:related:start -->
# Related

- Related: [map-nodes-directory](/node-schema/map-nodes-directory.md)
- Related: [map-session-log](/state/map-session-log.md)
- Related: [map-entry-md](/index/map-entry-md.md)
- Related: [map-graph-md](/index/map-graph-md.md)
- Related: [map-state-file](/state/map-state-file.md)
- Related: [map-bootstrap-state-file](/bootstrap/map-bootstrap-state-file.md)
- Related: [map-config-yaml](/config-and-prompts/map-config-yaml.md)
- Related: [map-conflict-files](/curation/map-conflict-files.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/architecture.md](docs/internals/architecture.md)
[2] [docs/installation.md](docs/installation.md)
<!-- kk:citations:end -->
