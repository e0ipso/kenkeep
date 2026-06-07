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

As it relates each new note to its neighbors, the curator does two things in the same pass: it sets the note's cross edges (which existing notes it links to) and it picks the note's home branch (the existing folder under `nodes/` whose subtree fits best). The note is written into that folder. Identity is the note id and is independent of where the note lives, so the same note could sit in any folder and its links never move. When no existing folder fits well, the note lands at the `nodes/` root; a later pass relocates it. Curation places notes into existing folders only and never creates, splits, or merges folders.

When a proposed note contradicts one you already have, the curator never overwrites it silently. It records the conflict, and `/kk-curate` walks each one with you: accept the new note, reject it, or keep the conflict as a record. This walkthrough is the only way contradictions get resolved.

### Rebalance (the final phase of curate)

Curation alone makes the tree lopsided over time: folders grow too large, a single note accretes several concepts, branches go sparse, and genuinely new topics have no home. The last phase of `/kk-curate` keeps the tree healthy, and it adds no chore: there is no second command and no second nudge.

A deterministic, LLM-free trigger reads the per-folder occupancy, tag-diversity, and note-size metrics that the rebuild already computes and decides, with a hysteresis margin, whether structural work is warranted. The margin is the safety mechanism: a split fires only when a folder is well past its high-water mark and a merge only when a branch is well below its low-water mark, with a deliberate gap between the two so a single borderline note cannot flip a folder back and forth across runs and the tree settles instead of thrashing. Most curate runs add a note or two, trip nothing, and skip the structural phase entirely at zero added cost.

When a threshold trips, the LLM reasons over the affected branches only and performs one of four operations: split folder (cluster a folder's notes into subfolders), split leaf (a bloated note becomes a folder of an index node plus two or more notes), merge (collapse a sparse or redundant branch), or create branch (a novel top-level topic). The moves are applied by a deterministic primitive that preserves each note's content byte-for-byte, so `git` records a rename rather than a delete-plus-add, and keeps note ids stable so no cross reference is rewritten. Split leaf is the one exception: it mints new ids for its parts and records a redirect from the old id so references still resolve. After the moves, the affected `index.md` nodes and `nodes_hash` regenerate deterministically, and curate prints a structural summary mapping the diff.

## 3. Review (you decide)

The files under `nodes/` are plain markdown. Review them with `git diff`, then keep with `git commit` or drop with `git restore <path>`. These notes shape every future session, so this is the one place a human stays in the loop.

Structural moves from the rebalance phase land in this same diff (act-and-fold): note writes and structural renames are reviewed together. Because `git restore` is path-scoped, you can reject just the structural moves and keep the note writes, or the other way round. There is no checkpoint inside the run; the commit gate is the only gate, which is why the trigger carries real hysteresis margin.

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
flat list of everything. At session start the harness injects **only** that root
index node (a bounded payload that does not grow with the size of the knowledge
base) together with a descent directive: read the root, pick the branches whose
intent and tags match the task, read those branch index nodes, descend only as
deep as the task needs, open only the leaves you have confirmed are relevant, and
follow cross edges to reach related notes in other branches. Notes link to each
other by `id`, never by path, so a
note can be moved to a better folder without breaking any reference (path is
presentation; the `id` is identity). `GRAPH.md` is the cross-reference graph the
harness reads on demand. The `index.md` files are regenerated automatically from
the notes; everything is plain text, diffable and version-controlled like any
code. Full frontmatter shape: [Schemas](internals/schemas.md).

For how the AI actually runs inside your harness session, see [Internals, Architecture](internals/architecture.md).
