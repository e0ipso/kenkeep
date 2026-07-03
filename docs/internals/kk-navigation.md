---
title: Knowledge base navigation
parent: Internals
nav_order: 6
---

# Knowledge base navigation directive

{% capture project_internal %}
This page documents intent for `kenkeep` maintainers. It has no runtime effect. The enforcement surface is [`src/lib/session-start.ts`](https://github.com/e0ipso/kenkeep/blob/main/src/lib/session-start.ts); change the directive there.
{% endcapture %}
{% include callout.html variant="note" title="Project-internal" content=project_internal %}

## The 3-layer model

When an agent in a consumer repo consults the knowledge base, the workflow is three layers, in order:

1. **Read `ENTRY.md`.** The entry catalog: whole-tree totals plus the top-level branch list. It is auto-injected into every session via the SessionStart additional-context payload, so the agent already has it.
2. **Shortlist with `grep -C 2 <term> nodes/`.** When the entry catalog's branches don't pinpoint the match, run a structured grep across `nodes/` instead of opening files speculatively. See [Why `-C 2`](#why--c-2).
3. **Open full node bodies only for confirmed matches.** Read a node body only after layers 1 and 2 produce a slug already believed relevant.

{% capture flow %}
Triage flows INDEX (layer 1) to grep (layer 2) to full read (layer 3). Each layer opens fewer files than the one before, and a body is opened only once a match is confirmed.
{% endcapture %}
{% include callout.html variant="tip" content=flow %}

This shape parallels [`thedotmack/claude-mem`](https://github.com/thedotmack/claude-mem)'s `mem-search` skill, whose `search` to `timeline` to `get_observations` workflow is the same three layers over a different memory store.

## Why the SessionStart payload carries the directive

The directive lives in the additional-context payload built by [`src/lib/session-start.ts`](https://github.com/e0ipso/kenkeep/blob/main/src/lib/session-start.ts) and nowhere else, for surface reachability:

- **SessionStart is the only artifact auto-injected into every consumer session**, across all five supported harnesses (Claude Code, Codex CLI, Cursor, OpenCode, GitHub Copilot CLI). Every consumer sees it at session start without lifting a finger — and it fires before any task is known, so it carries the orientation directive rather than task-specific results.
- **Every other static candidate surface needs a voluntary file-open first.** The consumer knowledge base's own `README.md`, the project's [`how-it-works.md`](../how-it-works.md) and [`daily-use.md`](../daily-use.md), the Jekyll site at `kenkeep.canpicasoft.com`, the package `README.md`: all require opening a file before reading the directive. That voluntary open is precisely the speculative read the directive suppresses.

{% include callout.html variant="warning" content="The directive ships unconditionally on every SessionStart, regardless of knowledge base size, staleness, or pending session count." %}

### Prompt-time injection complements, not replaces, this surface

On harnesses with a verified native prompt-submit context channel (Claude Code and Codex), a second auto-injected surface fires *after* the user's prompt is known: the prompt-time hook (`kk-prompt-context`) injects a small, bounded set of the leaf nodes most relevant to that prompt as summaries-plus-links. It does **not** carry or replace the navigation directive — it is a deterministic retrieval shortcut that gives the agent direct, task-specific candidates instead of relying solely on the three-layer descent above. SessionStart `ENTRY.md` orientation, the directive, staleness warnings, and curation nudges are unchanged. See [Hooks → Prompt-time injection](hooks.md#kk-prompt-contextcjs-prompt-time-injection).

## Why `-C 2`

The `-C 2` flag is named explicitly in the directive (not left as a bare `grep`) because it bridges layers 2 and 3.

Node frontmatter has a one-line `description:` field (OKF-native; see [`src/lib/schemas.ts`](https://github.com/e0ipso/kenkeep/blob/main/src/lib/schemas.ts)). When `grep -C 2 <term> nodes/` matches a tag, title token, or body sentence, the two surrounding lines almost always include that `description:`. So the agent gets a slug, the hit, and a one-line description of the node, which is enough triage signal to decide whether to open the full body without a round-trip to the user or speculative opens.

The flag is load-bearing; the value is tunable. If field experience later shows `2` is too narrow (e.g. very long frontmatter), widen to `-C 3`, but do not remove the flag.

## Source of truth

If the directive needs to change, change it in [`src/lib/session-start.ts`](https://github.com/e0ipso/kenkeep/blob/main/src/lib/session-start.ts). That file is the source of truth; this page describes intent.

A unit test in [`tests/lib/session-start.test.ts`](https://github.com/e0ipso/kenkeep/blob/main/tests/lib/session-start.test.ts) pins the directive into the payload via the `grep -C 2` + `nodes/` anchor phrase, so a future refactor cannot silently drop it. The test asserts the anchor only; copy-edits to surrounding wording remain free.
