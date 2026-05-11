---
title: Installation
nav_order: 3
---

# Installation

## Prerequisites

- Node.js 22+
- A Node project in the target repo (i.e. a `package.json` at the root). `init` patches it to wire up the commit-time secret scan.
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code/getting-started)

No Anthropic API key required. The tool uses `claude -p` and inherits your existing Claude Code auth.

## Install

In the root of your repository:

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
npm install
ai-knowledge-base doctor
```

This creates / updates:

- `.ai/knowledge-base/` — your knowledge base.
- `.claude/` — hooks and skills used by Claude Code.
- `.secretlintrc.json` — config for [secretlint](https://github.com/secretlint/secretlint), which scans staged files at commit time.
- `.husky/pre-commit` — runs `lint-staged` (which runs secretlint) before each commit.
- `package.json` — adds `husky`, `lint-staged`, `secretlint`, and the `@secretlint/secretlint-rule-preset-recommend` preset as devDeps; adds the `prepare: husky` script; adds a `lint-staged` block.
- A managed block in `.gitignore`.

`npm install` activates husky (via the `prepare` script) so the pre-commit hook is live in your local clone. Commit everything.

## Verify

`ai-knowledge-base doctor` checks your Node version, that `claude` is on PATH, that secretlint is installed, that husky + lint-staged are wired, and that the installation looks healthy. Exits 0 when clean.

## Upgrading

When a new version of the package ships:

```sh
npm install --save-dev @e0ipso/ai-knowledge-base@latest
npx @e0ipso/ai-knowledge-base init --assistants claude --upgrade
ai-knowledge-base doctor
```

`--upgrade` refreshes hooks, skills, and bundled prompts but preserves your project config and any local prompt overrides. Add `--dry-run` to preview.
