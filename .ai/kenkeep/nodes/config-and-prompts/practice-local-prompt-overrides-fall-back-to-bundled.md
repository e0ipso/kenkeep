---
schema_version: 2
id: practice-local-prompt-overrides-fall-back-to-bundled
title: Local prompt overrides fall back to bundled templates
kind: practice
tags:
  - prompts
  - customization
  - override
derived_from:
  - docs/internals/prompts.md
  - docs/troubleshooting.md
relates_to:
  - map-config-yaml
  - map-proposal-drain-hook
  - map-curate-command
  - map-bootstrap-incremental-command
depends_on: []
confidence: high
summary: >-
  Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md
  first, then the bundled fallback. Delete the override to revert.
---

# Local prompt overrides fall back to bundled templates

Each of the three LLM pipelines loads its prompt from a local override path under `.ai/kenkeep/.config/prompts/`, with the bundled `templates/prompts/<name>.md` as fallback. To customize: edit the override. To revert: delete it.

| Pipeline | Local override | Bundled fallback |
|---|---|---|
| Proposal extraction | `.config/prompts/proposal-extract.md` | `templates/prompts/proposal-extract.md` |
| Curator | `.config/prompts/curator.md` | `templates/prompts/curator.md` |
| Bootstrap-incremental | `.config/prompts/bootstrap-incremental.md` | `templates/prompts/bootstrap-incremental.md` |

The agent-driven `/kk-bootstrap` skill is the exception — there is no separate prompt file; edit `.claude/skills/kk-bootstrap/SKILL.md` (or the equivalent path for Codex/OpenCode) instead.

**How to apply:**

- Bump the top-of-file `Version: N` comment on every behavior change. Logs record the prompt content so historic decisions stay auditable.
- The proposal drain replaces `[TRANSCRIPT PLACEHOLDER, substituted at runtime]` with the redacted slice; if the placeholder is removed, the transcript is appended at the end. The bootstrap prompt replaces `[CHUNK PLACEHOLDER, substituted at runtime]` similarly. The curator replaces `[BATCH PLACEHOLDER]`. Don't strip these placeholders unless you want the appended-at-end fallback.
