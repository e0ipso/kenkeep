---
name: kb-bootstrap
description: First-time bootstrap of the project knowledge base from existing markdown documentation. Surveys docs, follows cross-references, and writes proposal files under `.ai/knowledge-base/_proposed/additions/` for human review. Supervised by the user — never writes to `nodes/` directly. Use when the user wants to seed an empty knowledge base from the project's existing docs.
allowed-tools: Read, Glob, Grep, Write, Bash(shasum:*), Bash(sha256sum:*), Bash(mkdir:*)
---

# kb-bootstrap

You are doing a one-time bootstrap of this project's knowledge base from its existing documentation. The user invoked this skill in their normal Claude Code session, so they are watching and can correct you in-flight if you go off track.

## Your task

Survey the project's existing markdown documentation, extract candidate knowledge nodes, and write them as proposal files for the user to review. You will work judgmentally — exploring, sampling, following cross-references — not exhaustively. This is a one-pass operation, supervised.

## Inputs

- An optional path argument from the user. If provided, treat that as the root of the docs scope. If absent, default to scanning: `docs/`, top-level `README.md`, top-level `CONTRIBUTING.md`, top-level `ARCHITECTURE.md`, and any `*.md` files at the repo root.

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

For large reference docs (e.g. method-by-method API listings), skim section headers and only read prose sections — skip auto-generated tables.

### 4. Identify candidates as you read

For each piece of content that looks like project knowledge, decide which kind:

**Practice candidates** — imperative project guidance:
- Conventions ("always use X for Y").
- Prohibitions ("don't do X").
- Gotchas (warnings, "be careful with…").
- Rationale ("we chose X because Y").
- Tooling/workflow ("tests run with X").

**Map candidates** — what exists:
- Named features, modules, services and what they do.
- Vocabulary specific to this project.
- File-tree locations of major systems.

When a piece of content has both aspects (e.g. "Use bravo_analytics.dispatcher — our service for tracking events"), split it: practice owns "use the dispatcher"; map owns "what the dispatcher is."

Skip:
- Auto-generated API reference.
- General programming knowledge that's not project-specific.
- Aspirational TODOs and "we should eventually" content.
- Licenses, changelogs, contributor lists.
- Boilerplate.

### 5. Write proposals

For each candidate, write a proposal file under `.ai/knowledge-base/_proposed/additions/<kind>-<slug>.md`. Use the standard proposal frontmatter:

```yaml
---
schema_version: 1
id: <kind>-<slug>
title: "..."
kind: practice | map
tags: [tag1, tag2, ...]
valid_from: <today's ISO timestamp>
valid_until: null
updated: <today's ISO timestamp>
supersedes: null
superseded_by: null
derived_from:
  - <source-doc-path-relative-to-repo>
relates_to: []
depends_on: []
confidence: medium
summary: "≤140 char summary"
proposal:
  kind: addition
  source_sessions: []
  target_node: null
  rationale: "bootstrap: <source-doc-path>"
  suggested_resolution: null
  curator_log: null
---

# <Title>

<Body in markdown — 1-4 short paragraphs.>
```

Default `confidence: medium` for bootstrap content. Existing docs may be stale or aspirational; the reviewer needs to assess each one. Use `confidence: high` only when the doc explicitly states the rule with rationale and the doc looks actively maintained.

If a candidate is sourced from multiple docs (you found the same convention discussed in two places), list all of them in `derived_from` and produce a single proposal, not duplicates.

### 6. Track state

After writing proposals, update `.ai/knowledge-base/.state/bootstrap-state.json`. For every doc you read (even ones that produced zero candidates), record its content SHA-256 and the timestamp. This lets future `bootstrap-incremental` runs skip unchanged files.

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
      "produced_proposals": ["<proposal-file-path>", ...]
    }
  }
}
```

Use the `Bash` tool to compute SHA-256: `shasum -a 256 <file>` on macOS/Linux, or `sha256sum <file>` on Linux.

### 7. Report back

When you're done, summarize for the user:

- How many docs you read; which ones you skipped and why.
- How many practice proposals you wrote.
- How many map proposals you wrote.
- Any cross-references you noticed but didn't follow (the user might want to direct you to those).
- Any docs that looked stale or contradictory that the user should double-check.

Then suggest the user run `ai-knowledge-base proposals review` to step through the proposals.

## Constraints

- **Never write to `.ai/knowledge-base/nodes/` directly.** All output goes to `_proposed/additions/`. The reviewer is the only path to `nodes/`.
- **Never auto-resolve perceived contradictions during bootstrap.** If you notice two docs that disagree, write both as separate proposals and mention the conflict in your final report. The reviewer decides.
- **Don't hallucinate rationale.** Only include "because…" content that's actually present in the source. If the doc just says "use X," your proposal says "use X" — not "use X because of [made-up reason]."
- **Don't try to read code files.** Stick to markdown documentation. The point of bootstrap is to extract what's already been written down.
- **Tools allowed:** `Read`, `Glob`, `Grep`, `Write` (for proposals and the state file only), `Bash` (for `shasum`/`sha256sum`/`mkdir -p` only). Do not run other Bash commands.

## When to stop

Stop and ask the user if:
- The docs directory contains more than ~100 markdown files (likely needs scoping).
- You encounter a doc that's clearly contentious or version-specific and you can't tell which version is current.
- You realize you've been over-extracting (proposals piling up faster than the user can plausibly review).
- The user has not corrected you in a while but your confidence is dropping.

Bootstrap is supervised. Defer to the human when uncertain.
