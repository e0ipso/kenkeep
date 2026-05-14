---
schema_version: 1
id: map-ai-knowledge-base-package
title: "@e0ipso/ai-knowledge-base npm package"
kind: map
tags: [package, cli, scope]
derived_from:
  - README.md
  - PRD.md
  - IMPLEMENTATION.md
relates_to: []
confidence: high
summary: "Per-repo npm tool that captures AI session knowledge into a reviewable markdown KB."
---

# @e0ipso/ai-knowledge-base npm package

The product is a single npm package installed per repo (`npx @e0ipso/ai-knowledge-base init --assistants claude`). It has two cooperating pieces: the **builder tool** (this npm package), and the **knowledge base** it writes into (`.ai/knowledge-base/` inside the consuming repo).

The builder ships a CLI (`init`, `doctor`, `status`, `curate`, `node add`, `conflict list/resolve`, `bootstrap-incremental`, `index rebuild`, `logs prune`), Claude Code hooks (capture, proposal drain, session start), and Claude Code skills (`/kb-curate`, `/kb-add`, `/kb-bootstrap`). It does not run services or require an Anthropic API key; LLM-driven steps spawn `claude -p` against the user's existing Claude Code installation.

The KB itself is plain markdown navigable like any code: reviewed via `git diff`, accepted via `git commit`, rejected via `git restore`.
