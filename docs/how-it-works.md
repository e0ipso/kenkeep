---
title: How it works
nav_order: 2
---

# How it works

Three things happen on a loop. You only ever drive one of them by hand, and even that one mostly drives itself.

```mermaid
flowchart LR
    A[AI session ends] --> B[Capture<br/>auto, redacted]
    B --> C[Extract candidates<br/>auto, background]
    C --> D[Curate<br/>nudged, autonomous<br/>writes to nodes/]
    D --> E[Review<br/>git diff / commit / restore]
    E --> F[(nodes/<br/>committed markdown)]
    F --> G[Inject into next session<br/>auto]
    G --> A
```

## 1. Capture (automatic)

When an AI session ends, a hook reads the transcript, runs it through [secretlint](https://github.com/secretlint/secretlint) (with the recommended preset) to redact secrets, and writes it to `.ai/knowledge-base/_sessions/`. Then a background extractor turns that transcript into structured _candidates_ (small bits of practice or vocabulary worth remembering).

You don't run this. It just happens.

### Capture events per harness

Which lifecycle events fire capture depends on the active harness:

| Harness | Capture events |
|---|---|
| Claude Code | `Stop`, `SessionEnd`, `PreCompact` |
| Codex CLI | `Stop` only |
| OpenCode | `session.idle` only |

Codex does not emit `SessionEnd` or `PreCompact`, so the Codex adapter wires capture and the lint tick to `Stop` only. OpenCode's idiomatic event surface is a long-lived plugin module subscribed to the runtime event bus; the OpenCode adapter ships a single TS plugin shim under `.opencode/plugins/kb.mjs` that dispatches `session.idle` and `session.created` events to per-event Node scripts under `.opencode/kb-hooks/`. OpenCode's hook payload does not carry a `transcript_path`, so the OpenCode capture script parses the on-disk session storage under `${XDG_DATA_HOME:-$HOME/.local/share}/opencode/storage/` (with `opencode export <sessionID>` as a fallback for crashed-mid-write sessions). Curation and review behave identically across all three harnesses.

## 2. Curate (mostly automatic)

When captured candidates accumulate, the system nudges you in the next session. You confirm (or run `/kb-curate` directly), and the curator runs autonomously as a `claude -p` subprocess: it reads pending candidates, compares them to existing nodes, and applies its decisions directly to `.ai/knowledge-base/nodes/`:

- **Additions**: write a new node file.
- **Modifications**: overwrite an existing node file.
- **Contradictions**: record the conflict in `.ai/knowledge-base/.state/pending-conflicts.json` and write nothing. The `/kb-curate` skill reads that file after the curator exits and walks each conflict with you in-session. You pick Replace (delete the existing node file and write the proposed one) or Reject (do nothing).

As part of the same run, the curator regenerates `INDEX.md` and `GRAPH.md` deterministically (no LLM) so the index reflects the current `nodes/` tree.

## 3. Review (you decide)

Review the changes under `.ai/knowledge-base/nodes/` with `git diff`. They are important; they may affect how the agent behaves in every future session. Tools like [self-review](https://github.com/e0ipso/self-review) work too. Accept with `git commit`, reject with `git restore <path>`. The lint-staged pre-commit hook regenerates `INDEX.md` and `GRAPH.md` and stages them into the same commit so the index never drifts from the committed nodes.

## Storage & graph

Every kept fact is a markdown file under `nodes/` with YAML frontmatter. Two kinds:

- **Practice**: _how we build._ Imperative guidance (conventions, prohibitions, gotchas).
- **Map**: _what exists._ Named things (modules, services, vocabulary).

Frontmatter carries the edges of a directed graph: `derived_from` for provenance, `relates_to` (loose) and `depends_on` (strict) for cross-references. Two artifacts are regenerated deterministically from `nodes/` every curate run:

- **`INDEX.md`**: catalog of every node (title, path, and tags). This is what gets injected into every new session.
- **`GRAPH.md`**: full edge listing. Not injected; the harness reads it on demand when it needs the whole graph.

Everything is plain text, diffable, reviewable, version-controlled like any code. The full frontmatter shape lives in [Schemas](internals/schemas.md).

## What's automatic vs. manual

| Step | Trigger | Who runs it |
|---|---|---|
| Capture session | session end (hook) | automatic |
| Extract candidates | capture completes | automatic (background) |
| Curate → write to `nodes/` | system nudge or `/kb-curate` | autonomous AI (asks only when contradicting) |
| Resolve contradictions | curator records one in `pending-conflicts.json` | `/kb-curate` skill walks each one with **you** |
| Regenerate `INDEX.md` / `GRAPH.md` | end of curate run + every commit (lint-staged) | automatic (deterministic) |
| Review changes to `nodes/` | whenever the curator wrote something | **you** (`git diff`, `git restore`, `git commit`) |
| Inject `INDEX.md` into new sessions | session start | automatic |

The cheap deterministic steps and the bulk-AI steps run on their own. The one place we keep humans in the loop is reviewing what to keep.
