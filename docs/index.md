---
title: Home
layout: home
nav_order: 1
---

# @e0ipso/ai-knowledge-base

Build and maintain a per-repo knowledge base from AI coding sessions, for use with [Claude Code](https://docs.claude.com/en/docs/claude-code).

## Quick start

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
ai-knowledge-base doctor
```

After `init`, AI sessions in this repo will automatically capture candidate knowledge. Run `ai-knowledge-base curate` (or `/kb-curate` from inside a session) to turn captures into reviewable proposals.

## What's next

- [Getting started](getting-started/) — installation, first capture, first curation.
- [Core concepts](core-concepts/) — how capture / curate / consume fit together, what counts as knowledge.
- [Bootstrap](bootstrap/) — seed the KB from existing READMEs and ADRs.
- [Customization](customization/) — editing prompts, settings reference.
- [Reference](reference/) — every CLI command, slash command, frontmatter field, hook event.
- [Troubleshooting](troubleshooting/) — reading `_logs/`, common issues.
- [Architecture](architecture/) — for contributors and would-be adapter authors.

## Status

Phase M0 is shipping. Capture (M1), stage-2 extraction (M2), curation (M3), bootstrap (M3.5), and consumption (M4) follow. See [Implementation phases](https://github.com/e0ipso/ai-knowledge-base/blob/main/IMPLEMENTATION.md#12-implementation-phases) for the full roadmap.
