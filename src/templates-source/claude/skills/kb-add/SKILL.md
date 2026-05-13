---
name: kb-add
description: Capture a knowledge-base node manually from the current session. Writes a new node directly under `.ai/knowledge-base/nodes/<kind>/`. The reviewer accepts via `git commit` and rejects via `git restore`. Use when the user wants to record a project convention, gotcha, rationale, or named-thing into the project knowledge base.
allowed-tools: Write
---

# kb-add

Capture a single piece of knowledge that the user wants to record in the project KB. The output is a new node file under `.ai/knowledge-base/nodes/<kind>/`. Review and acceptance happen through git: the user inspects the change with `git diff`, accepts with `git commit`, or rejects with `git restore <file>`.

## What to gather from the user

Ask the user concise questions and gather:

1. **Kind**: `practice` (how we build things) or `map` (what exists in the project).
2. **Title**: short imperative for practice; noun phrase for map. ≤ 80 chars.
3. **Summary**: one sentence, ≤ 140 chars. Will appear in INDEX.md.
4. **Tags**: comma-separated, e.g. `caching, drupal, render-array`.
5. **Body**: full markdown body. For practice: what to do/avoid and *why*. For map: what it is, where it lives, what it does.
6. **relates_to** *(optional)*: node ids this should link to. Useful for exceptions, siblings, extensions.
7. **Confidence**: `high`, `medium`, or `low`. Default to `high` for manual entries; recommend `medium` when the user is uncertain.

If anything is missing or ambiguous, ask before writing; the file lands directly in `nodes/`, and editing it after a commit means another commit.

## What to write

Create the file at `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`. The slug is derived from the title: lowercase, ascii letters and digits only, hyphens between words. **Before writing, check whether the file already exists** (e.g. via `Read`-equivalent intuition or by trying a more specific title). If a node with the same id already exists, do not overwrite; ask the user whether to refine the title or edit the existing node directly.

Frontmatter (every field is required):

```yaml
---
schema_version: 1
id: <kind>-<slug>
title: "<title>"
kind: <practice|map>
tags: [<tag1>, <tag2>, ...]
derived_from: []
relates_to: [<id1>, <id2>, ...]   # or [] if none
confidence: <high|medium|low>
summary: "<summary>"
---
```

Body: just the markdown the user gave you. Add a `# <title>` H1 at the top if the body doesn't already start with one.

## Constraints

- Only use the `Write` tool, and only on a single file path under `.ai/knowledge-base/nodes/<kind>/`.
- Do not modify or read any other file in the KB.
- Do not regenerate `INDEX.md` or `GRAPH.md`; the lint-staged pre-commit hook does that automatically (`ai-knowledge-base index rebuild --stage`) when the user commits.
- After writing, tell the user the file path and remind them to review with `git diff` and accept with `git commit` (or reject with `git restore <path>`).
