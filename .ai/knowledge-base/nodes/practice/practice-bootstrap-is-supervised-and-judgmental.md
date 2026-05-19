---
schema_version: 1
id: practice-bootstrap-is-supervised-and-judgmental
title: "Bootstrap is supervised and judgmental, not exhaustive"
kind: practice
tags: [bootstrap, supervision, sampling]
derived_from:
  - docs/installation.md
  - docs/daily-use.md
  - .claude/skills/kb-bootstrap/SKILL.md
relates_to:
  - map-kb-bootstrap-skill
depends_on: []
confidence: high
summary: "/kb-bootstrap samples, follows cross-references, and stops to ask when scope is unclear. Don't read every doc end-to-end."
---

# Bootstrap is supervised and judgmental, not exhaustive

The `/kb-bootstrap` skill is a supervised, judgmental, one-pass operation against the project's existing markdown docs. The user is in the loop and can correct it in flight via the normal session interface.

**Why:** existing docs include stale, aspirational, and version-specific content. An exhaustive sweep would pile up nodes faster than the user can plausibly review, and many of those nodes would pin claims that are no longer true. Sampling with cross-reference following picks high-signal content first; the user reviews each node with `git diff` and accepts or rejects with `git commit` / `git restore`.

**How to apply:**

- Read top-level entry points (`README.md`, `docs/index.md`, `docs/how-it-works.md`) completely — they frame project vocabulary.
- Sample representative content from the rest; follow links to drill in on high-signal pointers.
- For large reference docs (method-by-method API listings), skim section headers and only read prose sections; skip auto-generated tables.
- Stop and ask the user when: docs directory is >~100 markdown files, you encounter content that's clearly contentious or version-specific, you realize you've been over-extracting, or your confidence is dropping without correction.

For unsupervised re-runs after the first pass, use `bootstrap-incremental` (hash-aware, deterministic chunking).
