---
title: Home
layout: home
nav_order: 1
---

# @e0ipso/ai-knowledge-base

A **team-shared, git-native knowledge base** for AI coding sessions on [Claude Code](https://docs.claude.com/en/docs/claude-code), [OpenAI Codex CLI](https://developers.openai.com/codex/cli/), and [OpenCode](https://opencode.ai/). Knowledge lives in your repo as plain markdown — not in a per-user database on one developer's laptop — so it propagates to teammates through `git pull` and is **reviewable like code** in PR diffs and commit history.

No daemons. No services. No external runtimes. Just Node + git.

Your AI conversations produce a steady stream of project-specific knowledge — conventions, gotchas, named modules, decision rationale — and most of it evaporates when the session ends. This tool captures it, asks a human to curate it, commits it to the repo, and injects it back into every future session.

## Quick start

```sh
npx @e0ipso/ai-knowledge-base init --harnesses claude
npx @e0ipso/ai-knowledge-base doctor
```

Then code normally. When you want to turn captured material into knowledge nodes, run `/kb-curate` inside a Claude Code session (or `npx @e0ipso/ai-knowledge-base curate` in a shell). New nodes appear in `nodes/`; review with `git diff` and commit the ones you want to keep.

## Compared to claude-mem

[claude-mem](https://github.com/thedotmack/claude-mem) is the most visible project in this space and solves a different problem than this one. If you have already evaluated claude-mem, here is an honest read of the tradeoffs in both directions.

**Where claude-mem is the better fit**

- **Search.** claude-mem ships SQLite with FTS5 plus a vector index, so you can ask fuzzy semantic questions across past sessions and get ranked results. This tool relies on the AI agent reading `INDEX.md` and grepping markdown — fine for an LLM, not a substitute for a real search engine.
- **Zero-friction capture.** claude-mem captures observations automatically across the full session lifecycle, with no curation step. This tool deliberately puts a human in the loop between capture and merge — fewer entries land, but every entry is something a teammate signed off on.
- **Integration surface.** claude-mem advertises support for a wider set of harnesses and agents. This tool currently targets Claude Code, OpenAI Codex CLI, and OpenCode.

**Where this tool is differentiated**

- **Team-shared by default.** Knowledge lives in `nodes/` inside your repo, not in a per-user database at `~/.claude-mem/`. Distribution is `git pull`; a new teammate gets the full KB from a fresh clone.
- **PR-reviewable.** Every new knowledge entry is a markdown file in a commit. Reviewers see additions in `git diff`, comment in PRs, and reject with `git restore` — the same workflow as code.
- **No daemons, no external services.** No background worker, no local HTTP port, no vector DB, no second runtime. Just Node and git. Works in airgapped environments and behind corporate proxies without extra plumbing.
- **Lintable, named-node graph.** Nodes have stable ids and structured `relates_to` / `depends_on` edges. `npx @e0ipso/ai-knowledge-base lint` catches dangling references, naming drift, tag near-duplicates, and orphans before review.
- **Plain markdown outlives the tool.** If this package disappears tomorrow, you still have a tree of human-readable markdown files in your repo. Nothing is locked inside a database file or vector index format.

**Pick the one that matches your situation**

- Solo developer, want zero curation overhead and strong cross-session search of your own activity → **claude-mem**.
- Team that wants accumulated project knowledge to live in the repo, be reviewed like code, and be reproducible from a fresh `git clone` → **this tool**.

## Read next

- **[How it works](how-it-works.md)** - the 3-minute version.
- **[Installation](installation.md)** - prerequisites and first-time setup.
- **[Daily use](daily-use.md)** - the loop you'll run week to week.
- **[CLI reference](cli-reference.md)** - every command, one page.
- **[Troubleshooting](troubleshooting.md)** - when something looks wrong.

Curious how `INDEX.md` actually reaches the harness on every session start? See [Internals → Hooks](internals/hooks.md#kb-session-startmjs-consume). These are the harness's own hooks (Claude Code's `SessionStart`, `Stop`, etc.) that we register into, not an extension API exposed by `ai-knowledge-base`.

Contributors: see [Internals](internals/).
