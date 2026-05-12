---
schema_version: 1
id: map-kb-claude-skills
title: "Claude Code skills: /kb-curate, /kb-add, /kb-bootstrap"
kind: map
tags: [skills, claude-code, curate, add, bootstrap]
derived_from:
  - docs/cli-reference.md
  - docs/daily-use.md
  - PRD.md
relates_to: [map-ai-knowledge-base-cli, map-pending-conflicts-file]
depends_on: []
confidence: high
summary: "init --assistants claude installs three skills. /kb-curate and /kb-add map to CLI subcommands; /kb-bootstrap is agent-driven only and has no CLI equivalent."
---

# Claude Code skills: `/kb-curate`, `/kb-add`, `/kb-bootstrap`

`init --assistants claude` installs three skills under `.claude/skills/`:

| Command | Equivalent | Notes |
|---|---|---|
| `/kb-curate` | `ai-knowledge-base curate` | Runs the curator, then walks `.state/pending-conflicts.json` with the user in-session, applying chosen resolutions by editing nodes. |
| `/kb-add` | `ai-knowledge-base node add` | Interactive prompt to write a new node. Fails loud if the id already exists. |
| `/kb-bootstrap [path]` | (none) | Agent-driven only. Surveys existing docs, writes new nodes, never overwrites; supervised by the user in-session. |

The skill bodies live under `src/templates-source/claude/skills/<name>/SKILL.md` and are copied into the consumer's `.claude/skills/` by `init`. To customize the bootstrap behavior, edit `.claude/skills/kb-bootstrap/SKILL.md` directly; to customize the curate prompt, edit `.ai/knowledge-base/.config/prompts/curator.md`.
