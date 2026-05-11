---
title: Getting Started
nav_order: 2
has_children: true
permalink: /getting-started/
---

# Getting Started

Pages:

- [Installation & first init](installation.md) — install prerequisites, run `init`, verify with `doctor`.
- [First capture → curate](first-capture.md) — walk through one full capture / stage-2 / curate / review cycle.
- [CI recipe](ci-recipe.md) — keep the KB healthy in continuous integration.
- [Upgrading](upgrading.md) — refresh hooks, prompts, and config to a newer package version with `init --upgrade`.

After installation the three pipelines run on their own: capture fires on every Claude Code session event, stage-2 drains in the background, and consume injects `INDEX.md` at session start. The deliberate steps are `ai-knowledge-base curate` and `ai-knowledge-base proposals review` — both of which the contributor runs explicitly.
