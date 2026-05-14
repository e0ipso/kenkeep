---
schema_version: 1
id: practice-claude-code-v1-only
title: "v1 supports only Claude Code"
kind: practice
tags: [scope, assistant, v1]
derived_from:
  - PRD.md
  - docs/installation.md
relates_to: []
confidence: high
summary: "v1 ships with the Claude Code adapter only; other AI assistants are explicitly deferred to v2."
---

# v1 supports only Claude Code

Consuming the KB requires Claude Code (the v1 supported assistant) plus Node 22+ for the `SessionStart` hook. No Anthropic API key is required - the tool uses `claude -p` and inherits the user's existing Claude Code auth.

The `init --assistants <list>` flag accepts a list and exists for forward compatibility, but **only `claude` is supported in v1**. Multi-assistant adapters are a v1 non-goal and explicitly deferred to v2. The architecture isolates assistant-specific code behind [[map-adapter-interface]] so new adapters can be added without touching the rest of the system.

When adding a feature or writing a doc, assume Claude Code is the only consumer.
