---
title: Home
layout: home
nav_order: 1
---

# @e0ipso/ai-knowledge-base

A per-repo knowledge base built from your AI coding sessions, for [Claude Code](https://docs.claude.com/en/docs/claude-code).

## Quick start

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
ai-knowledge-base doctor
```

Then code normally. Sessions are captured automatically. Run `/kb-curate` (or `ai-knowledge-base curate`) when you want to turn captures into reviewable proposals.

## Sections

- [Getting started](getting-started/): install, first cycle, CI, upgrade.
- [Core concepts](core-concepts/): the three pipelines, the node model.
- [Bootstrap](bootstrap/): seed the KB from existing docs.
- [Customization](customization/): edit prompts, tune settings.
- [Reference](reference/): CLI, skills, hooks, schemas.
- [Troubleshooting](troubleshooting/).
- [Architecture](architecture/): for contributors.
