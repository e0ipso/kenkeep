---
title: KB navigation
parent: Internals
nav_order: 6
---

# KB navigation directive

> **Project-internal.** This page documents intent for `@e0ipso/ai-knowledge-base` maintainers. It is not shipped to consumer repos, is not part of any template, and has no runtime effect. Editing it does not change agent behavior. The enforcement surface is [`src/lib/session-start.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/session-start.ts); change the directive there.

## The 3-layer model

When an agent in a consumer repo needs to consult the knowledge base, the expected workflow is three layers, in order:

1. **Read `INDEX.md`.** This is the catalog: titles, tags, and one-line summaries grouped by section. It is auto-injected into every session via the SessionStart additional-context payload, so the agent already has it.
2. **Shortlist with `grep -C 2 <term> nodes/`.** When the INDEX titles do not contain a verbatim match for the question, the next move is a structured grep across `nodes/`, not speculatively opening files. The `-C 2` flag is operational, not decorative. See [Why `-C 2`](#why--c-2) below.
3. **Open full node bodies only for confirmed matches.** A node body is read only after layers 1 and 2 have produced a slug the agent already has reason to believe is relevant.

The comparative source for this shape is the [`thedotmack/claude-mem`](https://github.com/thedotmack/claude-mem) project's `mem-search` skill, whose `search` → `timeline` → `get_observations` workflow is the same three layers applied to a different memory store. The audit that surfaced the borrow is recorded in `.ai/task-manager/scratch/claude-mem-borrowed-ideas-tier-2-and-3.md` (item T2-3).

## Why the SessionStart payload is the only viable surface

The directive lives in the additional-context payload built by [`src/lib/session-start.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/session-start.ts) and nowhere else. The reason is surface reachability:

- The SessionStart payload is the only artifact this project injects into every consumer session automatically, across all three supported harnesses (Claude Code, Codex CLI, OpenCode). Every consumer of every harness sees it at session start without lifting a finger.
- Every other candidate surface (the consumer KB's own `README.md`, the project's own [`how-it-works.md`](../how-it-works.md) and [`daily-use.md`](../daily-use.md), the Jekyll site at `mateuaguilo.com/ai-knowledge-base`, the package's `README.md`) requires the agent to open a file before reading the directive. That is precisely the speculative read the directive is meant to suppress. Putting navigation guidance behind a voluntary read is wishful thinking.

The directive is unconditional: it ships on every SessionStart regardless of KB size, staleness, or pending session count. Two lines of standing guidance do not justify a config knob.

## Why `-C 2`

The `-C 2` flag is named explicitly in the directive (not left as an opaque "grep") because it is the bridge between layers 2 and 3.

KB node frontmatter has a one-line `summary:` field (see [`src/lib/schemas.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/schemas.ts)). When `grep -C 2 <term> nodes/` matches a tag, title token, or body sentence, the two surrounding lines of context almost always include that `summary:` line. So instead of a bare slug-and-token hit, the agent gets a slug, a hit, and a one-line description of what the node is about. That is enough triage signal to decide whether to open the full body without a round-trip to the user or speculative opens.

The two extra tokens in the directive ("with `-C 2`") buy a structural improvement to the second layer. The flag is the load-bearing part; the value is tunable. If field experience later shows `2` is too narrow for some KB layouts (e.g., very long frontmatter), widen to `-C 3`, but do not remove the flag.

## Source of truth

If the directive needs to change, change it in [`src/lib/session-start.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/src/lib/session-start.ts). That file is the source of truth; this page describes intent.

A unit test in [`tests/lib/session-start.test.ts`](https://github.com/e0ipso/ai-knowledge-base/blob/main/tests/lib/session-start.test.ts) pins the directive into the payload via the `grep -C 2` + `nodes/` anchor phrase, so a future refactor of the composition cannot silently drop it. The test asserts the anchor only; copy-edits to the surrounding wording remain free.

The cross-reference pattern here mirrors what [`docs/internals/hooks.md`](hooks.md) already does for hook scripts: the doc names the file that holds the runtime behavior, then describes the intent behind that behavior, rather than duplicating the implementation in prose.
