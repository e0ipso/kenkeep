---
schema_version: 2
id: map-codex-harness
title: Codex CLI harness adapter
kind: map
tags:
  - harness
  - codex
  - hooks
derived_from:
  - docs/installation.md
  - docs/installation/codex-toml-hooks-coexistence.md
  - docs/how-it-works.md
relates_to:
  - map-harness-adapter
depends_on: []
confidence: high
summary: >-
  OpenAI Codex CLI adapter; capture and lint tick on Stop only (no
  SessionEnd/PreCompact); skills under .agents/skills/.
---

# Codex CLI harness adapter

The Codex adapter wires capture and the lint tick to `Stop` only — Codex emits a `Stop` event at the end of every assistant turn but does not emit `SessionEnd` or `PreCompact`. Practical consequence: one Codex session contributes one rolling capture (overwritten on each Stop) instead of one per session-end plus a pre-compaction safety net.

Installed paths:

- `.codex/hooks.json` — hook registration file. Entries we own are tagged by command prefix and refreshed on `init --upgrade`; user-authored entries are preserved.
- `.codex/hooks/` — the hook scripts (`kk-capture.mjs`, `kk-session-start.mjs`, `kk-proposal-drain.mjs`, `kk-lint-tick.mjs`).
- `.agents/skills/` — the shared `kk-add`, `kk-bootstrap`, `kk-curate` skills. Codex reads skills from this shared location instead of a harness-specific subdirectory.

If `.codex/config.toml` already declares a `[hooks]` table, `init` refuses to write `.codex/hooks.json` and points at `docs/installation/codex-toml-hooks-coexistence.md` for the manual merge procedure. The package never auto-merges TOML because round-tripping loses comments and whitespace.

Codex exports no in-session env var, so harness identity must be passed explicitly (`--harness codex` or `cliDefaultHarness: codex` in `config.yaml`).
