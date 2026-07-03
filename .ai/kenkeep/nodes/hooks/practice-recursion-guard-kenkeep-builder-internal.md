---
type: practice
title: CLI launchers must set KENKEEP_BUILDER_INTERNAL=1 on the harness child
description: >-
  CLI launchers and the proposal-drain hook set KENKEEP_BUILDER_INTERNAL=1 on
  the harness child so nested SessionStart hooks don't re-fire.
tags:
  - recursion
  - hooks
  - env
kk_schema_version: 3
kk_id: practice-recursion-guard-kenkeep-builder-internal
kk_derived_from:
  - docs/internals/hooks.md
  - docs/troubleshooting.md
kk_relates_to:
  - map-capture-hook
  - map-proposal-drain-hook
  - map-session-start-hook
kk_depends_on: []
kk_confidence: high
---

# CLI launchers must set `KENKEEP_BUILDER_INTERNAL=1` on the harness child

All three knowledge base hooks (`kk-capture.mjs`, `kk-proposal-drain.mjs`, `kk-session-start.mjs`) exit immediately when the env var `KENKEEP_BUILDER_INTERNAL=1` is set on their process. Two CLI surfaces must propagate this var:

- The **CLI launchers** (`bootstrap`, `curate`, `node add`) that exec `<harness> -p "/kk-<name>"`.
- The **proposal-drain hook** that spawns a headless harness subprocess to extract candidates from a captured session.

Without the guard, a launcher's nested harness session would fire its own SessionStart hooks (capture nudge, proposal drain) and recurse back into the CLI — unbounded.

**Why this scope is narrower than it used to be.** Earlier releases ran bootstrap and curate as internal **batchers** that fanned out per-batch sub-agents from `BootstrapRunner` / `CuratorRunner`; the var had to be propagated through every layer of that fan-out. As of the launcher refactor, those runners are gone — the LLM work runs in a single host harness session, so the only sites that exec a harness binary are (a) the three CLI launchers and (b) the proposal-drain hook. Internal batchers no longer exist.

**How to apply:**

- Any new code path that execs a harness (`claude -p`, `codex exec`, `agent -p`, `opencode run`, etc.) for internal pipeline work must set `KENKEEP_BUILDER_INTERNAL=1` in the child's environment.
- A wrapper script around the harness CLI that leaks the var into a normal user session breaks capture (one of the documented "nothing is being captured" causes). When wrapping the harness CLI, only propagate the var into intentionally-internal subprocesses.

<!-- kk:related:start -->
# Related

- Related: [map-capture-hook](/hooks/map-capture-hook.md)
- Related: [map-proposal-drain-hook](/hooks/map-proposal-drain-hook.md)
- Related: [map-session-start-hook](/hooks/map-session-start-hook.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/hooks.md](docs/internals/hooks.md)
[2] [docs/troubleshooting.md](docs/troubleshooting.md)
<!-- kk:citations:end -->
