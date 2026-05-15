---
schema_version: 1
id: map-claude-skills
title: "Claude Code skills installed by init"
kind: map
tags: [skills, claude-code, slash-commands]
derived_from:
  - docs/cli-reference.md
  - PRD.md
  - IMPLEMENTATION.md
relates_to: []
confidence: high
summary: "Three slash commands inside Claude Code: /kb-curate, /kb-add, /kb-bootstrap."
---

# Claude Code skills installed by init

After `init --assistants claude`, three skills appear as slash commands inside a Claude Code session:

| Command | Backed by | What it does |
|---|---|---|
| `/kb-curate` | `ai-knowledge-base curate` plus in-session conflict resolution | Run the curator on pending session logs, then walk `pending-conflicts.json` entries with the user (Replace / Reject). |
| `/kb-add` | `ai-knowledge-base node add` | Capture a knowledge node manually from the current session. |
| `/kb-bootstrap [path]` | Agent-driven (no CLI equivalent) | One-time supervised seed from existing markdown docs into `nodes/`. |

`/kb-bootstrap` is agent-driven: it spawns a sub-agent via the `Task` tool, not a `claude -p` subprocess. It honors `bootstrapModel.name` on a best-effort basis, but ignores `bootstrapModel.effort` because the `Task` tool exposes no `effort` parameter.

The SKILL.md bytes installed at `.claude/skills/` are identical to the bytes Codex installs at `.agents/skills/` and OpenCode installs at `.opencode/skills/`; see [[practice-shared-skill-templates]]. Each body resolves the active `--harness` value at runtime via a small helper, per [[practice-explicit-harness-flag]].
