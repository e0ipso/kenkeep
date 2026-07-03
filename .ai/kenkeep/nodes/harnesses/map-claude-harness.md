---
type: map
title: Claude Code harness adapter
description: >-
  Claude Code adapter; wires capture to Stop/SessionEnd/PreCompact, registers in
  .claude/settings.json, installs skills at .claude/skills/.
tags:
  - harness
  - claude
  - hooks
kk_schema_version: 3
kk_id: map-claude-harness
kk_derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - docs/internals/hooks.md
  - '696e9b15-ef7a-409d-8445-493a3ee76eaa:map:0'
kk_relates_to:
  - map-harness-adapter
  - map-capture-hook
  - map-proposal-drain-hook
  - map-session-start-hook
kk_depends_on: []
kk_confidence: high
---
# Claude Code harness adapter

The Claude adapter wires capture on three lifecycle events: `Stop`, `SessionEnd`, and `PreCompact`. Hook registration lives in `.claude/settings.json` under one block per event; user-defined hooks in the same file are preserved on re-init.

Installed paths:

- `.claude/hooks/` - the per-event Node scripts (`kk-capture.mjs`, `kk-proposal-drain.mjs`, `kk-session-start.mjs`).
- `.claude/skills/` - the `kk-add`, `kk-bootstrap`, and `kk-curate` skill bodies (same SKILL.md bytes as the Codex and OpenCode installs).
- `AGENTS.md` - `init --harnesses claude` writes the shared kenkeep entry sentinel here. Claude Code auto-loads `CLAUDE.md`, not `AGENTS.md`, so Claude users import the sentinel from Claude memory with `@AGENTS.md` when they want the shared instructions loaded through Claude's memory surface.

Claude is the only harness that exports an in-session env marker (`CLAUDECODE=1`), so the detector picks it automatically when running inside a Claude session. Outside that context, the `--harness claude` flag or `cliDefaultHarness: claude` in `config.yaml` is required.

Install command: `npx kenkeep init --harnesses claude`. Doctor checks Node version, `claude` on PATH, hook registration in `.claude/settings.json`, installed-version marker, and ENTRY freshness.

<!-- kk:related:start -->
# Related

- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
- Related: [map-capture-hook](/hooks/map-capture-hook.md)
- Related: [map-proposal-drain-hook](/hooks/map-proposal-drain-hook.md)
- Related: [map-session-start-hook](/hooks/map-session-start-hook.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/how-it-works.md](docs/how-it-works.md)
[3] [docs/internals/hooks.md](docs/internals/hooks.md)
[4] [696e9b15-ef7a-409d-8445-493a3ee76eaa:map:0](696e9b15-ef7a-409d-8445-493a3ee76eaa:map:0)
<!-- kk:citations:end -->
