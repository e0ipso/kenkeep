---
title: Reference
nav_order: 6
has_children: true
permalink: /reference/
---

# Reference

- [CLI commands](cli.md) — every `ai-knowledge-base` subcommand.
- [Skills](skills.md) — `/kb-curate`, `/kb-add`, `/kb-bootstrap` (migrated from slash commands).
- [Hook events](hook-events.md) — the four registered Claude Code events (capture + stage-2 drain).
- [Settings](settings.md) — defaults for the stage-2 drain (bounds, timeouts, lock TTL).
- [`bootstrap-state.json` schema](bootstrap-state.md) — content-hash state recorded by the bootstrap pipelines.
- [Frontmatter schemas](frontmatter-schemas.md) — every YAML frontmatter and state-file shape (validated by Zod at read time).
- For the canonical failure-mode catalog, see [Troubleshooting > Common issues](../troubleshooting/common-issues.md) and [PRD §9](https://github.com/e0ipso/ai-knowledge-base/blob/main/PRD.md#9-failure-modes-the-user-sees).
