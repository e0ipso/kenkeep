---
schema_version: 1
id: practice-recursion-guard-kb-builder-internal
title: "Set KB_BUILDER_INTERNAL=1 on every claude -p child"
kind: practice
tags: [recursion, hooks, env]
derived_from:
  - docs/internals/hooks.md
  - docs/troubleshooting.md
relates_to:
  - map-capture-hook
  - map-proposal-drain-hook
  - map-session-start-hook
depends_on: []
confidence: high
summary: "All three hooks exit immediately when KB_BUILDER_INTERNAL=1 is set; the extractor, curator, and bootstrap-incremental must set this on every claude -p child."
---

# Set `KB_BUILDER_INTERNAL=1` on every `claude -p` child

All three KB hooks (`kb-capture.mjs`, `kb-proposal-drain.mjs`, `kb-session-start.mjs`) exit immediately when the env var `KB_BUILDER_INTERNAL=1` is set. The extractor, curator, and `bootstrap-incremental` set this on every `claude -p` child they spawn.

**Why:** spawned LLM sessions trigger the same hooks the parent session does. Without the guard, a curate run inside a Claude session would cause the spawned `claude -p` to fire `SessionStart` → run `kb-proposal-drain.mjs` → spawn its own `claude -p` → … unbounded recursion. The env-var sentinel is the cheapest possible cut-off.

**How to apply:**

- Any new code path that spawns `claude -p` (or another harness's headless driver) for internal pipeline work must propagate `KB_BUILDER_INTERNAL=1` into the child's environment.
- A wrapper script around `claude` that leaks the var into a normal user session will break capture (one of the documented "nothing is being captured" causes). When wrapping `claude`, only propagate the var into intentionally-internal subprocesses.
