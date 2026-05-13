---
schema_version: 1
id: map-ai-knowledge-base-cli
title: "ai-knowledge-base CLI: the package binary"
kind: map
tags: [cli, commander, binary]
derived_from:
  - docs/cli-reference.md
  - docs/internals/architecture.md
relates_to: [map-kb-claude-skills]
confidence: high
summary: "Commander-based CLI. Two shapes: deterministic (init, doctor, status, node add, index rebuild, logs prune) and LLM-invoking (curate, bootstrap-incremental)."
---

# `ai-knowledge-base` CLI: the package binary

`tsup` builds `dist/cli.js` from `src/cli.ts` (Commander entry) and `src/commands/<name>.ts` (one file per subcommand). Available as `ai-knowledge-base` after install or via `npx`.

Two shapes:

- **Deterministic** (no LLM): `init`, `doctor`, `status`, `node add`, `index rebuild`, `logs prune`.
- **LLM-invoking** (spawn `claude -p` via `runHeadlessClaude`, parse stream-JSON, validate with Zod): `curate`, `bootstrap-incremental`. All such subprocesses set `KB_BUILDER_INTERNAL=1` to disable the KB hooks inside the child.

Subcommands of note:

- `init --assistants claude [--force] [--upgrade [--dry-run]]`: first-time setup; requires `package.json` at the repo root.
- `doctor [--verbose]`: checks Node, `claude` on PATH, secretlint resolvable, commit-time scan wired, settings validity, INDEX freshness, dangling refs.
- `index rebuild [--stage]`: pure regen from `nodes/`; `--stage` is used by the lint-staged pre-commit hook.
- `logs prune [--older-than <duration>] [--dry-run]`: deletes `_logs/` traces older than the threshold (default 30 days; `30d`/`2w`/`12h`/`45m` accepted).
