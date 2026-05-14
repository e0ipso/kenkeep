---
schema_version: 1
id: practice-human-in-the-loop-via-git
title: "All KB changes go through git review"
kind: practice
tags: [review, git, workflow]
derived_from:
  - PRD.md
  - docs/how-it-works.md
  - docs/daily-use.md
relates_to: []
confidence: high
summary: "Curator, node-add, and bootstrap all write directly to nodes/; review is git diff, accept is git commit, reject is git restore."
---

# All KB changes go through git review

The system never modifies the KB without human approval. There is no separate staging directory: the curator, the `node add` command, and both bootstrap pipelines write directly to `nodes/<kind>/<id>.md`.

**Why:** the PRD lists "Reviewable like code" and "Not autonomous" as explicit goals. A reviewer should see proposed KB changes the same way they see code changes, with `git diff` as the review surface and the commit history as the audit trail.

**How to apply:**

- Accept changes with `git commit`.
- Reject changes with `git restore <path>` (or delete the file for a new addition).
- The pre-commit hook regenerates `INDEX.md`/`GRAPH.md` from staged nodes and stages them into the same commit, so the injected index never drifts.
- The same workflow holds for curator-detected contradictions, except resolution flows through the `/kb-curate` skill and `ai-knowledge-base conflict resolve`.

Never introduce an auto-merge or auto-apply path. Never edit the user's `nodes/` without the change showing up in `git diff`.
