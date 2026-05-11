---
name: kb-add
description: Capture a knowledge-base node manually from the current session. Writes a single proposal file under `.ai/knowledge-base/_proposed/additions/` for a human reviewer; never writes directly into `nodes/`. Use when the user wants to record a project convention, gotcha, rationale, or named-thing into the project knowledge base.
allowed-tools: Write
---

# kb-add

Capture a single piece of knowledge that the user wants to record in the project KB. The output is a *proposal* under `.ai/knowledge-base/_proposed/additions/`, never a direct write into `nodes/`. A human reviews it later via `ai-knowledge-base proposals review`.

## What to gather from the user

Ask the user concise questions and gather:

1. **Kind** — `practice` (how we build things) or `map` (what exists in the project).
2. **Title** — short imperative for practice; noun phrase for map. ≤ 80 chars.
3. **Summary** — one sentence, ≤ 140 chars. Will appear in INDEX.md.
4. **Tags** — comma-separated, e.g. `caching, drupal, render-array`.
5. **Body** — full markdown body. For practice: what to do/avoid and *why*. For map: what it is, where it lives, what it does.
6. **relates_to** *(optional)* — node ids this should link to. Useful for exceptions, siblings, extensions.
7. **Confidence** — `high`, `medium`, or `low`. Default to `high` for manual entries; recommend `medium` when the user is uncertain.

If anything is missing or ambiguous, ask — once you write the proposal, you cannot easily edit it without an extra round-trip.

## What to write

Create the file at `.ai/knowledge-base/_proposed/additions/<kind>-<slug>.md`. The slug is derived from the title: lowercase, ascii letters and digits only, hyphens between words. If a file with that name already exists, append a short discriminator (e.g. `-2`).

Frontmatter (every field is required; null where indicated):

```yaml
---
schema_version: 1
id: <kind>-<slug>
title: "<title>"
kind: <practice|map>
tags: [<tag1>, <tag2>, ...]
valid_from: <now in ISO 8601 UTC, e.g. 2026-05-11T10:00:00Z>
valid_until: null
updated: <same as valid_from>
supersedes: null
superseded_by: null
derived_from: []
relates_to: [<id1>, <id2>, ...]   # or [] if none
depends_on: []
confidence: <high|medium|low>
summary: "<summary>"
proposal:
  kind: addition
  source_sessions: []
  target_node: null
  rationale: "manual"
  suggested_resolution: null
  curator_log: null
---
```

Body: just the markdown the user gave you. Add a `# <title>` H1 at the top if the body doesn't already start with one.

## Constraints

- Only use the `Write` tool, and only on a single file path under `.ai/knowledge-base/_proposed/additions/`.
- Do not modify or read any other file in the KB.
- Do not regenerate `INDEX.md` or `GRAPH.md` — that happens on the next `ai-knowledge-base curate` run.
- After writing, tell the user: file path, the proposal id, and remind them to run `ai-knowledge-base proposals review`.
