---
title: Skills
parent: Reference
nav_order: 4
---

# Skills

`init --assistants claude` copies three Claude Code [skills](https://docs.claude.com/en/docs/claude-code/skills) into `.claude/skills/`. Invoke with `/kb-add`, `/kb-bootstrap`, `/kb-curate`. Claude can also reach for them when context matches the skill's `description`.

Legacy installs had these as slash commands under `.claude/commands/kb-{add,bootstrap,curate}.md`. `init` and `init --upgrade` remove the legacy files; user-authored slash commands are left alone.

## `kb-curate`

Wraps `ai-knowledge-base curate`. Runs the CLI, reports the summary, and recommends `proposals review`. The subprocess uses `claude -p`; recursion is blocked by `KB_BUILDER_INTERNAL=1`.

`allowed-tools`: `Bash(ai-knowledge-base curate:*)`.

## `kb-add`

In-session equivalent of `ai-knowledge-base node add`. Collects the seven node fields and writes the proposal directly to `_proposed/additions/`. No subprocess.

Both paths set `proposal.rationale: "manual"` so manual additions are distinguishable in review.

`allowed-tools`: `Write`.

## `kb-bootstrap`

Agent-driven first-time bootstrap. Surveys `docs/` and top-level `*.md`, follows cross-references, writes seed proposals to `_proposed/additions/`. Accepts an optional path argument (`/kb-bootstrap docs/architecture`).

Walkthrough: [Bootstrap > First-time](../bootstrap/first-time-bootstrap.md).

`allowed-tools`: `Read`, `Glob`, `Grep`, `Write`, `Bash(shasum:*)`, `Bash(sha256sum:*)`, `Bash(mkdir:*)`.
