---
type: map
title: Codex CLI harness adapter
description: >-
  OpenAI Codex CLI adapter; capture on Stop and PreCompact, lint tick on Stop
  only (no SessionEnd); skills under .agents/skills/.
tags:
  - harness
  - codex
  - hooks
kk_schema_version: 3
kk_id: map-codex-harness
kk_derived_from:
  - docs/installation.md
  - docs/installation/codex-toml-hooks-coexistence.md
  - docs/how-it-works.md
  - '7cada090-ddc5-4bba-88c8-2a97aae5bdbd:map:1'
kk_relates_to:
  - map-harness-adapter
  - map-capture-hook
  - map-kenkeep-directory
kk_depends_on: []
kk_confidence: high
---
The Codex adapter wires capture to `Stop` and `PreCompact`. Codex emits `Stop` at the end of every assistant turn and has emitted `PreCompact` since 0.139; it emits no `SessionEnd`, so the lint tick that rides on `SessionEnd` for Claude runs on `Stop` here instead.

Practical consequence: one Codex session contributes one rolling capture, overwritten on each `Stop`, plus a pre-compaction safety net.

Installed paths:

- `.codex/hooks.json` — hook registration file. Entries we own are tagged by command prefix and refreshed on `init --upgrade`; user-authored entries are preserved.
- `.ai/kenkeep/hooks/codex/` — the hook scripts (`kk-capture.cjs`, `kk-session-start.cjs`, `kk-proposal-drain.cjs`, `kk-lint-tick.cjs`). Gitignored, so each clone runs `init` to generate them.
- `.agents/skills/` — the shared `kk-add`, `kk-bootstrap`, `kk-curate` skills. Codex reads skills from this shared location instead of a harness-specific subdirectory.

If `.codex/config.toml` already declares a `[hooks]` table, `init` refuses to write `.codex/hooks.json` and points at the Codex notes in the installation docs for the manual merge procedure. The package never auto-merges TOML because round-tripping loses comments and whitespace.

Codex exports no in-session env var, so harness identity must be passed explicitly (`--harness codex` or `cliDefaultHarness: codex` in `config.yaml`).

<!-- kk:related:start -->
# Related

- Related: [map-harness-adapter](/harnesses/map-harness-adapter.md)
- Related: [map-capture-hook](/hooks/map-capture-hook.md)
- Related: [map-kenkeep-directory](/overview/map-kenkeep-directory.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/installation.md](docs/installation.md)
[2] [docs/installation/codex-toml-hooks-coexistence.md](docs/installation/codex-toml-hooks-coexistence.md)
[3] [docs/how-it-works.md](docs/how-it-works.md)
[4] [7cada090-ddc5-4bba-88c8-2a97aae5bdbd:map:1](7cada090-ddc5-4bba-88c8-2a97aae5bdbd:map:1)
<!-- kk:citations:end -->
