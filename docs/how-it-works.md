---
title: How it works
nav_order: 2
---

# How it works

kenkeep runs a loop around your AI sessions. Capture and injection happen on their own. You trigger curation, and you decide what to keep.

<p align="center">
  <img src="{{ '/assets/images/kenkeep-infography.png' | relative_url }}" alt="kenkeep knowledge lifecycle: capture transcripts, curate them into reviewed notes, and inject them back into every session" />
</p>

## 1. Capture (automatic)

When a session ends, a hook saves the transcript to `.ai/kenkeep/_sessions/`. You don't run this; it happens on its own. Each harness fires capture on the lifecycle events its runtime emits: Claude on `Stop`, `SessionEnd`, and `PreCompact`; Codex on `Stop`; Cursor on `stop`, `sessionEnd`, and `preCompact`; OpenCode on `session.idle`; and GitHub Copilot CLI on `sessionEnd` and `agentStop`, reading the per-session `events.jsonl` transcript under `${COPILOT_HOME:-~/.copilot}/session-state/<sessionID>/`.

## 2. Curate (you start it, the AI does most of the work)

Run `/kk-curate` (the system nudges you once transcripts pile up). It reads the captured sessions, drafts proposed notes, writes them under `.ai/kenkeep/nodes/`, then rebuilds the per-folder `index.md` table-of-contents tree (and the root catalog `INDEX.md`) plus `GRAPH.md`.

When a proposed note contradicts one you already have, the curator never overwrites it silently. It records the conflict, and `/kk-curate` walks each one with you: accept the new note, reject it, or keep the conflict as a record. This walkthrough is the only way contradictions get resolved.

## 3. Review (you decide)

The files under `nodes/` are plain markdown. Review them with `git diff`, then keep with `git commit` or drop with `git restore <path>`. These notes shape every future session, so this is the one place a human stays in the loop.

## What's stored

Every kept fact is a markdown file (a **leaf node**) under `nodes/`, organized
into a nested tree of topical folders. Each note carries a `kind`:

- **Practice**: _how we build._ Conventions, prohibitions, gotchas.
- **Map**: _what exists._ Modules, services, vocabulary.

`kind` is a label on the note, not where it lives: folders are topical, so a
note sits next to the other notes about the same topic regardless of kind.

Every folder carries a generated `index.md` (an **index node**): a
table-of-contents for that folder, listing its notes and linking down to the
index node of each subfolder. This is how kenkeep does **progressive
disclosure**: a session starts from the top-level catalog (`INDEX.md`, the root
index node) and descends only into the folders it needs, instead of loading one
flat list of everything. Notes link to each other by `id`, never by path, so a
note can be moved to a better folder without breaking any reference (path is
presentation; the `id` is identity). `GRAPH.md` is the cross-reference graph the
harness reads on demand. The `index.md` files are regenerated automatically from
the notes; everything is plain text, diffable and version-controlled like any
code. Full frontmatter shape: [Schemas](internals/schemas.md).

For how the AI actually runs inside your harness session, see [Internals, Architecture](internals/architecture.md).
