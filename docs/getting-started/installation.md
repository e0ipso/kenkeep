---
title: Installation
parent: Getting Started
nav_order: 1
---

# Installation

## Prerequisites

- Node.js 22+
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code/getting-started)
- [pre-commit](https://pre-commit.com) (`pip install pre-commit` or `brew install pre-commit`)
- [gitleaks](https://github.com/gitleaks/gitleaks): installed automatically by `pre-commit install`

No Anthropic API key is needed. The tool uses `claude -p` and inherits your existing Claude Code auth.

## Init

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
pre-commit install
ai-knowledge-base doctor
```

This creates `.ai/knowledge-base/`, `.claude/` hooks and skills, a `.pre-commit-config.yaml` with gitleaks, and updates `.gitignore`. Commit everything.

## Verify

`ai-knowledge-base doctor` checks Node version, `claude` and `gitleaks` on PATH, the installed-version marker, pre-commit config, and gitignore block. Exits 0 when clean.

## Re-running init

If `installed-version` is present, `init` refuses to overwrite. Use `--upgrade` to refresh templates while preserving customizations (see [Upgrading](upgrading.md)), or `--force` to overwrite everything.
