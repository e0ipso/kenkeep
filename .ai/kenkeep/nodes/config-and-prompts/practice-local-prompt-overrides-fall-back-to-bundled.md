---
type: practice
title: Local prompt overrides fall back to bundled templates
description: >-
  Each LLM pipeline loads its prompt from .ai/kenkeep/.config/prompts/<name>.md,
  then the bundled fallback; delete the override to revert.
tags:
  - prompts
  - customization
  - override
kk_schema_version: 3
kk_id: practice-local-prompt-overrides-fall-back-to-bundled
kk_derived_from:
  - docs/internals/prompts.md
  - docs/troubleshooting.md
kk_relates_to:
  - map-config-yaml
  - map-proposal-drain-hook
  - map-curate-command
  - map-bootstrap-incremental-command
kk_depends_on: []
kk_confidence: high
---

# Local prompt overrides fall back to bundled templates

Each of the three LLM pipelines loads its prompt from a local override path under `.ai/kenkeep/.config/prompts/`, with the bundled `templates/prompts/<name>.md` as fallback. To customize: edit the override. To revert: delete it.

| Pipeline | Local override | Bundled fallback |
|---|---|---|
| Proposal extraction | `.config/prompts/proposal-extract.md` | `templates/prompts/proposal-extract.md` |
| Curator | `.config/prompts/curator.md` | `templates/prompts/curator.md` |
| Bootstrap-incremental | `.config/prompts/bootstrap-incremental.md` | `templates/prompts/bootstrap-incremental.md` |

The agent-driven `/kk-bootstrap` skill is the exception — there is no separate prompt file; edit the installed SKILL.md for your harness instead:

| Harness | Skills path |
|---|---|
| Claude | `.claude/skills/kk-bootstrap/SKILL.md` |
| Codex | `.agents/skills/kk-bootstrap/SKILL.md` |
| Cursor | `.cursor/skills/kk-bootstrap/SKILL.md` |
| OpenCode | `.opencode/skills/kk-bootstrap/SKILL.md` |
| Copilot | `.github/skills/kk-bootstrap/SKILL.md` |

**How to apply:**

- Bump the top-of-file `Version: N` comment on every behavior change. Logs record the prompt content so historic decisions stay auditable.
- The proposal drain replaces `[TRANSCRIPT PLACEHOLDER, substituted at runtime]` with the redacted slice; if the placeholder is removed, the transcript is appended at the end. The bootstrap prompt replaces `[CHUNK PLACEHOLDER, substituted at runtime]` similarly. The curator replaces `[BATCH PLACEHOLDER]`. Don't strip these placeholders unless you want the appended-at-end fallback.

<!-- kk:related:start -->
# Related

- Related: [map-config-yaml](/config-and-prompts/map-config-yaml.md)
- Related: [map-proposal-drain-hook](/hooks/map-proposal-drain-hook.md)
- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-bootstrap-incremental-command](/bootstrap/map-bootstrap-incremental-command.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [docs/internals/prompts.md](docs/internals/prompts.md)
[2] [docs/troubleshooting.md](docs/troubleshooting.md)
<!-- kk:citations:end -->
