---
type: practice
title: Don't translate event names across harness adapters
description: >-
  HookEvent is opaque string; each adapter declares the event names its host
  runtime emits natively. No global enum, no translation.
tags:
  - adapter
  - events
  - harness
kk_schema_version: 3
kk_id: practice-no-event-translation-across-adapters
kk_derived_from:
  - CONTRIBUTING.md
  - docs/internals/architecture.md
kk_relates_to:
  - map-harness-adapter
  - map-claude-harness
  - map-codex-harness
  - map-opencode-harness
kk_depends_on: []
kk_confidence: high
---

# Don't translate event names across harness adapters

The `HookEvent` type is opaque `string`. Each harness adapter declares the event names its host runtime actually emits — there is no global enum and no per-adapter translation layer.

- Claude uses `Stop` / `SessionEnd` / `PreCompact` / `SessionStart`.
- Codex reuses Claude's vocabulary but only emits `Stop` and `SessionStart`.
- OpenCode uses `session.idle` / `session.created`.

**Why:** event semantics differ across runtimes in ways a global enum would lie about. Translating OpenCode's `session.idle` to a fake `Stop` would imply behavioral parity that does not exist (Codex's missing `SessionEnd` and `PreCompact` mean its capture story is genuinely different — one rolling capture per session, not one per session end). Adapters owning their own vocabulary keeps that asymmetry visible.

**How to apply:**

- Adding a new adapter? Pick whatever names the host runtime exposes natively. Don't map them to Claude's names.
- Logic that depends on event semantics belongs in the adapter, not in the harness-neutral core.
- Adapters never reach into each other's directories. Shared logic lives in `src/lib/` and `src/commands/` (and shared skills under `src/templates-source/skills/`).

<!-- kk:related:start -->
# Related

- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
- Related: [map-claude-harness](/harnesses/map-claude-harness.md)
- Related: [map-codex-harness](/harnesses/map-codex-harness.md)
- Related: [map-opencode-harness](/harnesses/map-opencode-harness.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [CONTRIBUTING.md](CONTRIBUTING.md)
[2] [docs/internals/architecture.md](docs/internals/architecture.md)
<!-- kk:citations:end -->
