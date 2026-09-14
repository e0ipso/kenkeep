---
title: How it works
nav_order: 2
---

# How it works

Kenkeep runs a loop around your AI sessions. Two steps are automatic. Two are yours.

<p align="center">
  <img src="{{ '/assets/diagrams/loop.svg' | relative_url }}" alt="The kenkeep loop: capture (automatic), curate (you run /kk-curate), review (git diff and git commit), recall (automatic), then back to capture on the next session" />
</p>

## 1. Capture (automatic)

When a session ends, a hook saves the transcript to `.ai/kenkeep/_sessions/`. Each harness fires it on its own lifecycle events. Claude Code, for example, fires on `Stop`, `SessionEnd`, and `PreCompact`. The full list is in [Installation](installation.md#per-harness-notes).

Wrap anything in `<kk-private>…</kk-private>` and it never reaches disk.

## 2. Curate (you start it)

Run `/kk-curate` in your assistant when the nudge appears. It reads the captured sessions, drafts one note per durable fact, places each note in the best-fitting existing folder under `nodes/`, and rebuilds the index files.

When a new note contradicts one you already have, nothing is overwritten. The skill shows both and asks you to accept, reject, skip, or keep the conflict on record.

The last phase checks whether the folder tree has gone lopsided. Most runs trip nothing. When one does, the skill splits or merges only the affected branches, as plain renames you review in the same diff.

## 3. Review (you decide)

Notes are markdown files. Inspect them with `git diff`, keep them with `git commit`, drop them with `git restore <path>`. After a restore, run `npx kenkeep index rebuild` so the index forgets the dropped note.

## 4. Recall (automatic)

At session start a hook injects `ENTRY.md`, the catalog of top-level branches, plus a directive to descend by relevance. The assistant opens only the branch indexes and notes the task needs. The payload stays small however large the base grows.

<p align="center">
  <img src="{{ '/assets/images/progressive-disclosure.png' | relative_url }}" alt="kenkeep progressive disclosure: load the root index node, select relevant branches by intent and tags, descend into those branch indexes, then open only the confirmed-relevant leaf nodes and follow their cross-edges" />
</p>

On Claude Code and Codex a second hook fires after each prompt you type. It injects summaries and links for the handful of notes most relevant to that prompt, ranked locally without an LLM call.

## What is stored

<p align="center">
  <img src="{{ '/assets/diagrams/layout.svg' | relative_url }}" alt="What lives in .ai/kenkeep/: committed files shared with the team (nodes, ENTRY.md, GRAPH.md, FOLDER_SUMMARIES.md, conflicts, config.yaml, prompt overrides) and gitignored per-user files (_sessions, _logs, hooks, .state)" />
</p>

Each note is a markdown file with frontmatter. A `practice` note says how we build: conventions, prohibitions, gotchas. A `map` note says what exists: modules, services, vocabulary. Notes link to each other by id, never by path, so a note can move between folders without breaking a link. Every folder gets a generated `index.md`, and the whole `nodes/` tree is an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundle.

Frontmatter reference: [Internals, Prompts and schemas](internals/prompts.md#node-frontmatter).
