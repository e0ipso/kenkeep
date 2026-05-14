---
schema_version: 1
id: map-prompts-directory
title: "Prompt overrides at .config/prompts/"
kind: map
tags: [prompts, customization, llm]
derived_from:
  - docs/internals/prompts.md
relates_to: []
confidence: high
summary: "Three editable prompts: proposal-extract.md, curator.md, bootstrap-incremental.md, with bundled fallbacks."
---

# Prompt overrides at `.config/prompts/`

The three LLM pipelines load their prompt from a local override first, falling back to the bundled template:

| Pipeline | Local override | Bundled fallback |
|---|---|---|
| Proposal extraction | `.config/prompts/proposal-extract.md` (v2) | `templates/prompts/proposal-extract.md` |
| Curator | `.config/prompts/curator.md` (v3) | `templates/prompts/curator.md` |
| Bootstrap-incremental | `.config/prompts/bootstrap-incremental.md` (v2) | `templates/prompts/bootstrap-incremental.md` |

Each prompt carries a top-of-file `Version: N` comment; logs record the prompt content so historic decisions stay auditable. Delete the local file to revert to the bundled prompt.

The agent-driven `/kb-bootstrap` skill is *not* in this list. Its body lives at `.claude/skills/kb-bootstrap/SKILL.md`; edit that file to customize bootstrap behavior.

Placeholders substituted at runtime:

- Proposal: `[TRANSCRIPT PLACEHOLDER - substituted at runtime]`.
- Curator: `[BATCH PLACEHOLDER]`.
- Bootstrap-incremental: `[CHUNK PLACEHOLDER - substituted at runtime]`.

If the placeholder is missing, the runtime appends the payload at the end of the prompt.
