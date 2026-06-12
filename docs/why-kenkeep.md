---
title: Why kenkeep
nav_order: 5
---

# Why kenkeep

Every AI coding tool has some answer to the memory problem. Most answers are either solo (machine-local, not shared) or infrastructure-heavy (daemons, databases, API keys). kenkeep's answer is different: knowledge lives in the repo as plain markdown, every change is a git diff a human approves, and the whole system runs on Node and git alone.

## How it compares

| Approach | Storage | Team sharing | Review gate | Infra required |
|---|---|---|---|---|
| claude-mem | SQLite + ChromaDB, user-scoped | No — per-user, per-machine | None — writes automatically | Bun worker on port 37777, Python/uv |
| Claude Code auto-memory | `~/.claude/` markdown, machine-local | No — not synced | None — AI writes directly | None (built-in, Claude only) |
| MCP memory servers | JSONL or graph DB, server-scoped | Only if server is shared | None | MCP server process |
| mem0 / Letta / Zep | Vector + graph DB, cloud or self-hosted | Yes, via service | None — auto ADD/UPDATE/DELETE | Vector DB, embedding API |
| Cursor rules / Copilot instructions / AGENTS.md | Committed markdown files | Yes — via git | Hand-edit only | None |
| **kenkeep** | **Committed markdown in repo** | **Yes — via git pull** | **Every node needs git commit** | **Node 22+ and git** |

## Why this matters

- **The knowledge base is a team artifact.** It travels with the repo. Every teammate who clones gets all accumulated knowledge — no plugin to install, no account to create, no sync step beyond `git pull`.
- **Human-in-the-loop is the design, not a workaround.** No node reaches the committed knowledge base without a human reading the diff and running `git commit`. Contradictions get a conflict file under `.ai/kenkeep/conflicts/`; you resolve them explicitly, not the AI.
- **Zero infrastructure beyond Node + git + filesystem.** No daemons, no databases, no API keys, no background services. Nothing to provision, secure, or keep alive.
- **Progressive disclosure keeps context bounded by branch count, not node count.** Only `ENTRY.md` (the branch catalog) is injected at session start; the assistant descends into branch indexes and individual nodes only when relevant. The payload stays small as the base grows.
- **Works across five harnesses from one knowledge base.** Claude Code, Codex CLI, Cursor, OpenCode, and GitHub Copilot CLI all share the same node format, curator, and review surface. A knowledge base curated under one harness loads correctly under any other.

## What kenkeep does not do

- **No cross-repo memory.** Each repo has its own knowledge base; there is no shared layer across projects.
- **No semantic search.** Navigation is structural — branch indexes and markdown links, not embeddings or vector queries.
- **No automatic curation.** The AI drafts proposals; a human approves every commit. This is deliberate: the human gate is what makes the knowledge base trustworthy, not a missing feature.
- **Capture quality depends on curation cadence.** Knowledge from recent sessions only reaches the knowledge base when someone runs `/kk-curate` and commits the result. A team that rarely curates gets a knowledge base that lags reality by the same margin.
