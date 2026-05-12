---
name: kb-bootstrap
description: First-time bootstrap of the project knowledge base from existing markdown documentation. Surveys docs, follows cross-references, and writes new node files directly under `.ai/knowledge-base/nodes/`. Supervised by the user, who reviews each node with `git diff` before committing. Use when the user wants to seed an empty knowledge base from the project's existing docs.
allowed-tools: Read, Glob, Grep, Write, Bash(shasum:*), Bash(sha256sum:*), Bash(mkdir:*)
---

# kb-bootstrap

You are doing a one-time bootstrap of this project's knowledge base from its existing documentation. The user invoked this skill in their normal Claude Code session, so they are watching and can correct you in-flight if you go off track.

## Your task

Survey the project's existing markdown documentation, extract candidate knowledge nodes, and write them as new node files directly under `nodes/`. The user reviews everything with `git diff` and accepts or rejects each node with `git commit` or `git restore <path>`. You will work judgmentally - exploring, sampling, following cross-references - not exhaustively. This is a one-pass operation, supervised.

## Inputs

- An optional path argument from the user. If provided, treat that as the root of the docs scope. If absent, default to scanning: `docs/`, top-level `README.md`, top-level `CONTRIBUTING.md`, top-level `ARCHITECTURE.md`, and any `*.md` files at the repo root.

## Configuration

Before you start, read `.ai/knowledge-base/config.yaml` (falling back to `~/.config/ai-knowledge-base/config.yaml`) and look for a `bootstrapModel:` block. If `bootstrapModel.name` is set (one of `haiku`, `sonnet`, `opus`) and you decide to delegate any portion of this work to a sub-agent via the `Task` tool, pass that value as the sub-agent's `model` parameter. Ignore `bootstrapModel.effort`: the `Task` tool exposes no `effort` parameter, so the effort half of the config only applies to `claude -p` subprocesses (the `bootstrap-incremental` CLI honors both halves). If the config or the key is absent, omit `model` so the sub-agent inherits its default.

## Steps

### 1. Survey the structure

Use `Glob` and `Grep` to map the documentation. Build a mental model of:
- Which docs are entry points (top-level READMEs, docs site landing pages).
- Which look like reference (per-module docs, API listings).
- Which look like architectural narrative (ADRs, design docs).
- Which might be stale (`legacy/`, `archive/`, dated past).
- Which to skip entirely (auto-generated API dumps, license files, changelogs).

Tell the user briefly what you found before reading anything in depth: "I see ~30 markdown files across docs/, three module READMEs, two top-level overviews. I'll prioritize the overviews first, then sample modules." This gives them a chance to correct your plan.

### 2. Read entry points first

Read the top-level entry points completely. They usually frame project vocabulary, name the major components, and establish the conventions vocabulary you'll need to recognize.

### 3. Sample and follow cross-references

Don't read every file end-to-end. Sample representative content and follow links between docs. If a top-level README mentions "see docs/architecture/auth.md for the authentication design," that's a high-signal pointer to follow.

For large reference docs (e.g. method-by-method API listings), skim section headers and only read prose sections - skip auto-generated tables.

### 4. Identify candidates as you read

For each piece of content that looks like project knowledge, decide which kind:

**Practice candidates** - imperative project guidance:
- Conventions ("always use X for Y").
- Prohibitions ("don't do X").
- Gotchas (warnings, "be careful with…").
- Rationale ("we chose X because Y").
- Tooling/workflow ("tests run with X").

**Map candidates** - what exists:
- Named features, modules, services and what they do.
- Vocabulary specific to this project.
- File-tree locations of major systems.

When a piece of content has both aspects (e.g. "Use bravo_analytics.dispatcher - our service for tracking events"), split it: practice owns "use the dispatcher"; map owns "what the dispatcher is."

Skip:
- Auto-generated API reference.
- General programming knowledge that's not project-specific.
- Aspirational TODOs and "we should eventually" content.
- Licenses, changelogs, contributor lists.
- Boilerplate.

### 5. Write nodes

For each candidate, write a node file at `.ai/knowledge-base/nodes/<kind>/<kind>-<slug>.md`. **Before writing, check whether the file already exists** - bootstrap is conservative and never overwrites an existing node. If you hit a collision, refine the title or skip the candidate and call it out in your final report.

Use the standard node frontmatter. Quote every string value, including the ISO timestamps, so YAML does not auto-parse them as Date objects (the schema rejects non-string timestamps):

```yaml
---
schema_version: 1
id: <kind>-<slug>
title: "..."
kind: practice | map
tags: [tag1, tag2, ...]
valid_from: "<today's ISO timestamp>"
valid_until: null
updated: "<today's ISO timestamp>"
supersedes: null
superseded_by: null
derived_from:
  - <source-doc-path-relative-to-repo>
relates_to: []
depends_on: []
confidence: medium
summary: "≤140 char summary"
---

# <Title>

<Body in markdown - 1-4 short paragraphs.>
```

Default `confidence: medium` for bootstrap content. Existing docs may be stale or aspirational; the reviewer needs to assess each one with `git diff`. Use `confidence: high` only when the doc explicitly states the rule with rationale and the doc looks actively maintained.

If a candidate is sourced from multiple docs (you found the same convention discussed in two places), list all of them in `derived_from` and produce a single node, not duplicates.

### 6. Track state

After writing nodes, update `.ai/knowledge-base/.state/bootstrap-state.json`. For every doc you read (even ones that produced zero candidates), record its content SHA-256 and the timestamp. This lets future `bootstrap-incremental` runs skip unchanged files.

Schema:

```json
{
  "schema_version": 1,
  "last_full_bootstrap_at": "<ISO>",
  "last_incremental_at": null,
  "docs": {
    "<relative-path>": {
      "content_sha256": "<sha256-hex>",
      "last_processed_at": "<ISO>",
      "produced_nodes": ["<kind>/<filename>.md", ...]
    }
  }
}
```

Use the `Bash` tool to compute SHA-256: `shasum -a 256 <file>` on macOS/Linux, or `sha256sum <file>` on Linux.

### 7. Report back

When you're done, summarize for the user:

- How many docs you read; which ones you skipped and why.
- How many practice nodes you wrote.
- How many map nodes you wrote.
- Any collisions you skipped (file already existed) - the user may want to merge content manually.
- Any cross-references you noticed but didn't follow (the user might want to direct you to those).
- Any docs that looked stale or contradictory that the user should double-check.

Then tell the user to review with `git diff nodes/`, accept individual files with `git add nodes/<kind>/<file>.md && git commit`, and reject the rest with `git restore nodes/<kind>/<file>.md`.

## Constraints

- **Never overwrite an existing node in `nodes/`.** Bootstrap only writes files that don't already exist. If you'd collide, skip and report.
- **Never auto-resolve perceived contradictions during bootstrap.** If you notice two docs that disagree, write only one as a node and surface the conflict in your final report so the user can decide. Do not write a second contradictory node.
- **Don't hallucinate rationale.** Only include "because…" content that's actually present in the source. If the doc just says "use X," your node says "use X" - not "use X because of [made-up reason]."
- **Don't try to read code files.** Stick to markdown documentation. The point of bootstrap is to extract what's already been written down.
- **Tools allowed:** `Read`, `Glob`, `Grep`, `Write` (for nodes and the state file only), `Bash` (for `shasum`/`sha256sum`/`mkdir -p` only). Do not run other Bash commands.

## When to stop

Stop and ask the user if:
- The docs directory contains more than ~100 markdown files (likely needs scoping).
- You encounter a doc that's clearly contentious or version-specific and you can't tell which version is current.
- You realize you've been over-extracting (nodes piling up faster than the user can plausibly review).
- The user has not corrected you in a while but your confidence is dropping.

Bootstrap is supervised. Defer to the human when uncertain.
