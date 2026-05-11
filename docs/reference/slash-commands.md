---
title: Slash commands
parent: Reference
nav_order: 4
---

# Slash commands

`init --assistants claude` copies these slash command bodies into `.claude/commands/`. They are invoked from inside a Claude Code session by typing `/kb:<name>`.

## `/kb:curate`

Wraps the `ai-knowledge-base curate` CLI. The slash command body instructs the agent to:

1. Run `ai-knowledge-base curate` in the repo root.
2. Report the resulting summary line (proposals written, drops, batches, run id).
3. Recommend `ai-knowledge-base proposals review` as the next step.

The curator subprocess uses `claude -p` internally; recursion is blocked by the `KB_BUILDER_INTERNAL=1` env var.

## `/kb:add`

In-session companion to `ai-knowledge-base node add`. Asks the user for the seven fields needed for a node (kind, title, summary, tags, body, relates_to, confidence), assembles valid proposal frontmatter, and writes the file directly under `.ai/knowledge-base/_proposed/additions/`. No `claude -p` subprocess — the slash command runs in the user's existing session.

Both `/kb:add` and `ai-knowledge-base node add` write proposals carrying `proposal.kind: addition` and `proposal.rationale: "manual"`, so manual additions are distinguishable in review.

## `/kb:bootstrap`

Agent-driven first-time bootstrap from the project's existing markdown documentation. Surveys `docs/` (and a small set of well-known top-level docs by default), reads representative content, follows cross-references between docs, and writes seed proposals under `_proposed/additions/`. The user can pass an optional path argument (`/kb:bootstrap docs/architecture`) to scope the scan.

The slash command body lives at `.claude/commands/kb-bootstrap.md` — `init` copies it from the npm package's `templates/claude/commands/kb-bootstrap.md`. Edit your repo copy to scope or extend the agent's behavior.

What the agent does:

1. Surveys the docs tree with `Glob`/`LS` and briefly reports its plan before reading anything in depth.
2. Reads entry-point docs first (top-level READMEs, index pages).
3. Samples representative content and follows cross-references; skips auto-generated reference tables.
4. Splits candidates by kind — imperative guidance → practice; named entities → map.
5. Writes proposals under `.ai/knowledge-base/_proposed/additions/<kind>-<slug>.md` with `proposal.rationale: "bootstrap: <source-doc>"` and `derived_from: [<source-doc>]`. Confidence defaults to `medium`.
6. Updates `.ai/.kb-builder/bootstrap-state.json` with the SHA-256 and timestamp of every doc it read.
7. Reports back with proposal counts, docs skipped (and why), and any contradictions worth your attention.

Bootstrap is supervised: the agent never writes to `nodes/` directly, never auto-resolves contradictions, and stops to ask if it suspects it's over-extracting. For unsupervised re-runs after the first pass, use the CLI:

```sh
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/
```

See [Bootstrap > First-time bootstrap](../bootstrap/first-time-bootstrap.md) for the full walkthrough.

## Coming in later phases

| Slash command | Phase |
|---|---|
| `/kb:show <topic-or-slug>` | M5 |
| `/kb:propose-from-session` | M5 |
