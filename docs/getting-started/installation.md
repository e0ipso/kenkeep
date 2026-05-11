---
title: Installation & first init
parent: Getting Started
nav_order: 1
---

# Installation & first init

## Prerequisites

- **Node.js 22+** on PATH. Check with `node --version`.
- **Claude Code CLI**. Install per the [Claude Code docs](https://docs.claude.com/en/docs/claude-code/getting-started).
- **[pre-commit](https://pre-commit.com)** for the secret-scan hook. `pip install pre-commit` or `brew install pre-commit`.
- **[gitleaks](https://github.com/gitleaks/gitleaks)** for secret scanning. Installed transparently by `pre-commit install` when the hook config references it.

You do **not** need an Anthropic API key. The tool drives `claude -p` as a subprocess and inherits your existing Claude Code authentication (subscription or API key).

## First init

From the root of the repo where you want a knowledge base:

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
pre-commit install
ai-knowledge-base doctor
```

This will:

1. Create `.ai/knowledge-base/` with the directory skeleton (`nodes/`, `_proposed/`, `_sessions/`, `_logs/`, plus `INDEX.md`, `GRAPH.md`, and a `README.md` that explains the layout to teammates).
2. Create `.claude/` with the bootstrap slash command and the compiled stage-1 capture hook (`kb-capture.mjs`). The hook is registered against `Stop`, `SessionEnd`, and `PreCompact` in `.claude/settings.json`. See [Reference > Hook events](../reference/hook-events.md) for what each one does.
3. Create or extend `.gitignore` to keep `_sessions/` and `_logs/` out of git by default.
4. Drop a `.pre-commit-config.yaml` with a [gitleaks](https://github.com/gitleaks/gitleaks) hook (or merge entry if you already have one).
5. Write `.ai/knowledge-base/.state/installed-version` recording which package version produced the templates.

Commit everything `init` created.

## Verifying

`ai-knowledge-base doctor` checks:

- Node 22+
- `claude` CLI on PATH
- `gitleaks` on PATH (warning if missing — install via your package manager)
- `installed-version` marker present
- `.pre-commit-config.yaml` present and contains a gitleaks entry
- `.gitignore` contains the ai-knowledge-base block

A clean run exits 0 with no errors or warnings.

## Re-running init

If you re-run `init` in a repo that already has `installed-version`, the tool refuses to overwrite by default. Pass `--force` to copy fresh templates; existing user-authored files (like a customized `README.md` in `.ai/knowledge-base/`) will be overwritten.

> **Note:** `init --upgrade` (a three-way merge for upgrading templates while preserving user customizations) is planned for v2. For now, `--force` is the heavy-handed alternative.
