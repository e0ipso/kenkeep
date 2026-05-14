---
schema_version: 1
id: map-knowledge-base-directory
title: ".ai/knowledge-base/ directory layout"
kind: map
tags: [layout, directory, kb]
derived_from:
  - docs/internals/architecture.md
  - IMPLEMENTATION.md
relates_to: []
confidence: high
summary: "Root of the per-repo knowledge base. Holds nodes, INDEX/GRAPH, sessions, logs, state, and config."
---

# `.ai/knowledge-base/` directory layout

The knowledge base lives inside the consuming repo at `.ai/knowledge-base/`. Contents:

- `nodes/{practice,map}/<id>.md` - canonical knowledge, the only files that survive review.
- `INDEX.md` / `GRAPH.md` - regenerated deterministically from `nodes/`; injected into sessions.
- `_sessions/<YYYYMMDD-HHmm-<sessionId>>.md` - per-session redacted transcript checkpoints.
- `_logs/{proposal,curator,bootstrap-incremental}/*.jsonl` - stream-JSON traces from every LLM run. Gitignored.
- `.state/state.json` - lock plus `last_nudged_at`. Gitignored.
- `.state/pending-conflicts.json` - curator-detected contradictions awaiting in-session resolution.
- `.state/bootstrap-state.json` - SHA-256 cache of processed docs for incremental bootstrap. Gitignored.
- `.state/installed-version` - package version + selected assistants. Committed.
- `.config/prompts/*` - local prompt overrides. Committed.
- `config.yaml` - per-project tunables. Committed.

A managed gitignore block hides `_logs/`, `_sessions/` (by default), and the runtime state files.
