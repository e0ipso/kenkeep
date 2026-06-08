---
schema_version: 2
id: practice-review-nodes-via-git
title: Review node changes via git
kind: practice
tags:
  - review
  - git
  - workflow
derived_from:
  - README.md
  - docs/how-it-works.md
  - docs/daily-use.md
  - docs/troubleshooting.md
relates_to:
  - map-curate-command
  - map-kk-bootstrap-skill
depends_on: []
confidence: high
summary: >-
  All node changes are reviewed via git diff; accept with git commit, reject
  with git restore. Same workflow for curator output and bootstrap output.
---

# Review node changes via git

Every path that writes to `nodes/` (the curator, `/kk-bootstrap`, `bootstrap-incremental`, `node add`, manual hand-edits) lands changes in the working tree for review with `git diff`. There is no separate review UI.

- **Accept** — `git add nodes/<folder>/<file>.md && git commit`.
- **Reject** — `git restore nodes/<folder>/<file>.md` (or delete the file if it's a new addition).
- **Tooling** — `git diff nodes/` or a tool like [self-review](https://github.com/e0ipso/self-review).

**Why:** nodes affect how the agent behaves in every future session, so each one deserves a code-review-grade decision. Reusing the existing git review workflow means no new tools to learn, and the commit history doubles as the timeline of record (this is why node frontmatter carries no timestamps).

**How to apply:**

- Don't invent in-place "accept" mechanisms in skills or CLIs; defer to `git commit` and `git restore`.
- The pre-commit hook (when wired via lint-staged with `index rebuild --stage`) regenerates `ENTRY.md`/`GRAPH.md` and stages them into the same commit, so the injected index never drifts from the committed nodes — don't bypass that hook.
- For curator-detected contradictions, let the `/kk-curate` skill walk the conflict files with the user; that's the authoritative resolution path, not a separate manual edit.
