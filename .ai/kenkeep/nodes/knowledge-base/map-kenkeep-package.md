---
schema_version: 2
id: map-kenkeep-package
title: kenkeep npm package
kind: map
tags:
  - overview
  - package
  - npm
derived_from:
  - README.md
  - docs/index.md
  - docs/how-it-works.md
relates_to:
  - map-harness-adapter
  - map-kenkeep-directory
depends_on: []
confidence: high
summary: >-
  Per-repo knowledge base built from AI sessions; installs hooks, captures
  redacted slices, lets a curator write nodes/, injects ENTRY into every new
  session.
---

# `kenkeep` npm package

The package builds and maintains a per-repo knowledge base from AI coding sessions for Claude Code, OpenAI Codex CLI, and OpenCode. Sessions produce project-specific knowledge (conventions, prohibitions, gotchas, named modules, rationale); without intervention this evaporates at session end. The package captures it, runs it through human-supervised curation, and injects the resulting index back into every future session.

Two cooperating pieces. The **builder tool** (this npm package) installs hooks under the harness's native directory (`.claude/`, `.codex/`, `.opencode/`) and a knowledge directory under `.ai/kenkeep/`. Hooks capture redacted session slices, an async proposal extractor turns them into structured candidates, and the curator writes new knowledge nodes directly under `nodes/`. Review is via `git diff`; commit accepts, `git restore` rejects.

A `SessionStart` hook injects `ENTRY.md` into every new AI session so the harness starts each conversation with the team's accumulated context. The knowledge base itself is plain markdown — readable, diffable, reviewable like code.

CLI binary: `kenkeep` (run via `npx kenkeep ...`). Requires Node 22+. No API key — the tool spawns the harness's own headless driver (`claude -p`, `codex exec`, or `opencode run`) and inherits its auth.
