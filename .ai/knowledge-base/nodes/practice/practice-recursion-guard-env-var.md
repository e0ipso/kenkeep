---
schema_version: 1
id: practice-recursion-guard-env-var
title: "Set KB_BUILDER_INTERNAL=1 on every internal claude -p subprocess"
kind: practice
tags: [hooks, recursion, env-vars, claude-code]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to: [map-claude-hooks]
depends_on: []
confidence: high
summary: "All three KB hooks exit immediately when KB_BUILDER_INTERNAL=1. The extractor, curator, and bootstrap-incremental set this on every claude -p child so spawned sessions don't trigger our hooks recursively."
---

# Set KB_BUILDER_INTERNAL=1 on every internal claude -p subprocess

The three hook scripts (`kb-capture.mjs`, `kb-stage2-drain.mjs`, `kb-session-start.mjs`) all exit immediately when `KB_BUILDER_INTERNAL=1` is set in the environment.

The extractor, curator, and `bootstrap-incremental` set this env var on every `claude -p` child they spawn, so the SessionStart that fires inside the headless child does not trigger our hooks recursively.

If you wrap the `claude` CLI in a shim, propagate `KB_BUILDER_INTERNAL=1` only into intentionally-internal subprocesses. Leaking it into a real interactive session disables capture for that session.
