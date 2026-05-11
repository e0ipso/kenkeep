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

Ships in M3.5. First-time agent-driven bootstrap from existing markdown documentation.

## Coming in later phases

| Slash command | Phase |
|---|---|
| `/kb:show <topic-or-slug>` | M5 |
| `/kb:propose-from-session` | M5 |
