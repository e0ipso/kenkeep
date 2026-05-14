---
title: Home
layout: home
nav_order: 1
---

# @e0ipso/ai-knowledge-base

A per-repo knowledge base built from your [Claude Code](https://docs.claude.com/en/docs/claude-code) sessions. Your AI conversations produce project-specific knowledge - conventions, gotchas, named modules - and most of it evaporates when the session ends. This tool captures it, lets you review it, and injects it back into every future session.

## Quick start

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
npx @e0ipso/ai-knowledge-base doctor
```

Then code normally. When you want to turn captured material into knowledge nodes, run `/kb-curate` inside a Claude Code session (or `npx @e0ipso/ai-knowledge-base curate` in a shell). New nodes appear in `nodes/`; review with `git diff` and commit the ones you want to keep.

## Read next

- **[How it works](how-it-works.md)** - the 3-minute version.
- **[Installation](installation.md)** - prerequisites and first-time setup.
- **[Daily use](daily-use.md)** - the loop you'll run week to week.
- **[CLI reference](cli-reference.md)** - every command, one page.
- **[Troubleshooting](troubleshooting.md)** - when something looks wrong.

Curious how `INDEX.md` actually reaches the assistant on every session start? See [Internals → Hooks](internals/hooks.md#kb-session-startmjs-consume). These are the assistant's own hooks (Claude Code's `SessionStart`, `Stop`, etc.) that we register into, not an extension API exposed by `ai-knowledge-base`.

Contributors: see [Internals](internals/).
