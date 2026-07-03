---
type: map
title: kenkeep npm package
description: >-
  Per-repo knowledge base from AI sessions: installs hooks, captures redacted
  slices, a curator writes nodes/, ENTRY injected each session.
tags:
  - overview
  - package
  - npm
kk_schema_version: 3
kk_id: map-kenkeep-package
kk_derived_from:
  - README.md
  - docs/index.md
  - docs/how-it-works.md
kk_relates_to:
  - map-harness-adapter
  - map-kenkeep-directory
kk_depends_on: []
kk_confidence: high
---

# `kenkeep` npm package

The package builds and maintains a per-repo knowledge base from AI coding sessions for Claude Code, OpenAI Codex CLI, Cursor, OpenCode, and GitHub Copilot CLI. Sessions produce project-specific knowledge (conventions, prohibitions, gotchas, named modules, rationale); without intervention this evaporates at session end. The package captures it, runs it through human-supervised curation, and injects the resulting index back into every future session.

Two cooperating pieces. The **builder tool** (this npm package) installs hooks under the harness's native directory (`.claude/`, `.codex/`, `.cursor/`, `.opencode/`, or `.copilot/kk-hooks/`) and a knowledge directory under `.ai/kenkeep/`. Hooks capture redacted session slices, an async proposal extractor turns them into structured candidates, and the curator writes new knowledge nodes directly under `nodes/`. Review is via `git diff`; commit accepts, `git restore` rejects.

A `SessionStart` hook injects `ENTRY.md` into every new AI session so the harness starts each conversation with the team's accumulated context. The knowledge base itself is plain markdown — readable, diffable, reviewable like code.

CLI binary: `kenkeep` (run via `npx kenkeep ...`). Requires Node 22+. No API key — the tool spawns the harness's own headless driver (`claude -p`, `codex exec`, `opencode run`, `cursor`, or `copilot`) and inherits its auth.

<!-- kk:related:start -->
# Related

- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
- Related: [map-kenkeep-directory](/overview/map-kenkeep-directory.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [README.md](README.md)
[2] [docs/index.md](docs/index.md)
[3] [docs/how-it-works.md](docs/how-it-works.md)
<!-- kk:citations:end -->
