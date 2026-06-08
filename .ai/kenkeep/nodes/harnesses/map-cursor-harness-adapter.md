---
schema_version: 2
id: map-cursor-harness-adapter
title: Cursor harness adapter
kind: map
tags:
  - harness
  - cursor
  - hooks
derived_from:
  - docs/installation.md
  - docs/how-it-works.md
  - 'https://cursor.com/docs/hooks'
  - 'https://cursor.com/docs/cli/using'
relates_to:
  - map-harness-adapter
depends_on: []
confidence: high
summary: >-
  Cursor IDE agent adapter; native .cursor/hooks.json with camelCase events;
  headless via agent -p; transcripts from hook stdin or
  ~/.cursor/projects/.../agent-transcripts/.
---

# Cursor harness adapter

The Cursor adapter is a shell-hook adapter (Codex-shaped): hook scripts under `.cursor/hooks/` and registration in `.cursor/hooks.json`. It does **not** reuse `.claude/hooks` natively. Cursor can load Claude Code hook entries from `.claude/settings.json` when the user enables third-party skills, but that bridge alone is insufficient for knowledge base parity (stdin field names, session-start stdout envelope, transcript format, and headless CLI differ).

Installed paths:

- `.cursor/hooks.json` — `"version": 1` with camelCase event keys (`stop`, `sessionEnd`, `preCompact`, `sessionStart`). Owned entries use commands containing `.cursor/hooks/kk-` and are replaced on `init --upgrade`.
- `.cursor/hooks/` — `kk-capture.cjs`, `kk-session-start.cjs`, `kk-proposal-drain.cjs`, `kk-lint-tick.cjs`.
- `.cursor/skills/` — shared `kk-add`, `kk-bootstrap`, `kk-curate` skills (same bytes as other harnesses).

Capture triggers: `stop`, `sessionEnd`, `preCompact` (full parity with Claude's three capture events). `sessionEnd` also runs `kk-lint-tick`, matching Claude's SessionEnd cadence.

Hook stdin uses Cursor's common schema: `conversation_id`, `transcript_path`, `hook_event_name`, `workspace_roots`. The capture hook maps `conversation_id` → session log `session_id` (UUID v5 normalization when the id is not UUID v4).

Transcript source: `transcript_path` from hook stdin or `CURSOR_TRANSCRIPT_PATH` env; fallback glob under `~/.cursor/projects/*/agent-transcripts/**/*<conversation_id>*.jsonl` (newest wins).

Headless curate/bootstrap/proposal: `agent -p` / `--print` with `--output-format json`; child env includes `KENKEEP_BUILDER_INTERNAL=1`. Doctor probes `agent --version`, then `cursor agent --version`.

Env detection: `CURSOR_VERSION` non-empty resolves to `cursor`. Claude detection requires `CLAUDECODE=1` only (not `CLAUDE_PROJECT_DIR`, which Cursor aliases). When both `CLAUDECODE=1` and `CURSOR_VERSION` are set, Claude wins (registry walk order).

`listMemoryFiles` returns `[]` for v1 (no documented Claude-style persisted memory IRI surface).

Official docs: [Hooks](https://cursor.com/docs/hooks), [Third Party Hooks](https://cursor.com/docs/reference/third-party-hooks), [CLI using](https://cursor.com/docs/cli/using), [Skills](https://cursor.com/docs/skills), [CLI output format](https://cursor.com/docs/cli/reference/output-format).
