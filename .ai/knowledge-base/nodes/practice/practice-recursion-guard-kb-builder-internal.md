---
schema_version: 1
id: practice-recursion-guard-kb-builder-internal
title: "CLI launchers must set KB_BUILDER_INTERNAL=1 on the harness child"
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
summary: "The CLI launchers (bootstrap, curate, node add) and the proposal-drain hook must set KB_BUILDER_INTERNAL=1 on the harness child they exec so the nested session's SessionStart hooks do not re-fire."
---

# CLI launchers must set `KB_BUILDER_INTERNAL=1` on the harness child

All three KB hooks (`kb-capture.mjs`, `kb-proposal-drain.mjs`, `kb-session-start.mjs`) exit immediately when the env var `KB_BUILDER_INTERNAL=1` is set on their process. Two CLI surfaces must propagate this var:

- The **CLI launchers** (`bootstrap`, `curate`, `node add`) that exec `<harness> -p "/kb-<name>"`.
- The **proposal-drain hook** that spawns a `claude -p` subprocess to extract candidates from a captured session.

Without the guard, a launcher's nested harness session would fire its own SessionStart hooks (capture nudge, proposal drain) and recurse back into the CLI — unbounded.

**Why this scope is narrower than it used to be.** Earlier releases ran bootstrap and curate as internal **batchers** that fanned out per-batch sub-agents from `BootstrapRunner` / `CuratorRunner`; the var had to be propagated through every layer of that fan-out. As of the launcher refactor, those runners are gone — the LLM work runs in a single host harness session, so the only sites that exec a harness binary are (a) the three CLI launchers and (b) the proposal-drain hook. Internal batchers no longer exist.

**How to apply:**

- Any new code path that execs a harness (`claude -p`, `codex exec`, `agent -p`, `opencode run`, etc.) for internal pipeline work must set `KB_BUILDER_INTERNAL=1` in the child's environment.
- A wrapper script around the harness CLI that leaks the var into a normal user session breaks capture (one of the documented "nothing is being captured" causes). When wrapping the harness CLI, only propagate the var into intentionally-internal subprocesses.
