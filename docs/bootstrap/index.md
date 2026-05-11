---
title: Bootstrap
nav_order: 4
has_children: true
permalink: /bootstrap/
---

# Bootstrap

The bootstrap pipelines seed the knowledge base from your project's existing markdown documentation. There are two of them, deliberately:

- **First-time bootstrap (`/kb-bootstrap`)** — a supervised, agent-driven pass run inside a normal Claude Code session. Best for messy real-world docs trees where judgment is required to skip auto-generated reference, follow cross-references, and recognize boilerplate.
- **Incremental bootstrap (`ai-knowledge-base bootstrap-incremental`)** — a deterministic, hash-aware CLI for re-runs. Cheap, scriptable, idempotent. Use it after adding or modifying source docs to re-extract just the changes.

Both pipelines write proposals to `_proposed/additions/` and update the same `bootstrap-state.json`. The reviewer (`ai-knowledge-base proposals review`) is the merge mechanism — accepted proposals land in `nodes/`, rejected ones are deleted.

Pages:

- [First-time bootstrap](first-time-bootstrap.md) — the agent-driven `/kb-bootstrap` walkthrough.
- [Incremental bootstrap](incremental-bootstrap.md) — the CLI for re-runs.

See [IMPLEMENTATION §6.10](https://github.com/e0ipso/ai-knowledge-base/blob/main/IMPLEMENTATION.md#610-bootstrap-pipelines) for the design and [PRD §8.6–§8.7](https://github.com/e0ipso/ai-knowledge-base/blob/main/PRD.md#86-first-time-bootstrap-from-existing-docs-optional-one-off) for usage scenarios.
