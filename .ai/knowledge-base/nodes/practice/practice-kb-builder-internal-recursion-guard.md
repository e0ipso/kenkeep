---
schema_version: 1
id: practice-kb-builder-internal-recursion-guard
title: "KB_BUILDER_INTERNAL=1 prevents hook recursion"
kind: practice
tags: [hooks, recursion, env, subprocess]
derived_from:
  - docs/internals/hooks.md
  - docs/internals/architecture.md
relates_to: []
confidence: high
summary: "All three KB hooks exit immediately if KB_BUILDER_INTERNAL=1; the LLM pipelines set it on every claude -p child."
---

# `KB_BUILDER_INTERNAL=1` prevents hook recursion

All three KB hooks (`kb-capture`, `kb-proposal-drain`, `kb-session-start`) exit immediately when the environment variable `KB_BUILDER_INTERNAL=1` is set. The extractor, curator, and `bootstrap-incremental` set this on every `claude -p` child they spawn, so the spawned session does not trigger our hooks recursively.

**Why:** without the guard, a curate run that spawns `claude -p` would itself fire `SessionStart`/`Stop` in the child, triggering capture, proposal drain, and `SessionStart` injection in an infinite loop.

**How to apply:**

- Every new `claude -p` invocation in this codebase must set `KB_BUILDER_INTERNAL=1` in the subprocess env. `runHeadlessClaude` is the central path; if you add a new spawn site, route through it.
- If you wrap the `claude` CLI yourself (a shell alias, a launcher script), propagate `KB_BUILDER_INTERNAL=1` only into *intentionally-internal* subprocesses. A wrapper that leaks the variable into a normal user session will cause silent capture failures.
- New hook scripts must check the variable first thing and exit silently when set.
