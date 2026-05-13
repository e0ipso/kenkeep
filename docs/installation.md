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
npx @e0ipso/ai-knowledge-base doctor
```

This creates / updates:

- `.ai/knowledge-base/`: your knowledge base.
- `.claude/`: hooks and skills used by Claude Code.
- `.secretlintrc.json`: config for [secretlint](https://github.com/secretlint/secretlint), which scans staged files at commit time.
- `.husky/pre-commit`: runs `lint-staged` (which runs secretlint) before each commit.
- `package.json`: adds `husky`, `lint-staged`, `secretlint`, and the `@secretlint/secretlint-rule-preset-recommend` preset as devDeps; adds the `prepare: husky` script; adds a `lint-staged` block.
- A managed block in `.gitignore`.

`npm install` activates husky (via the `prepare` script) so the pre-commit hook is live in your local clone. Commit everything.

## Verify

`ai-knowledge-base doctor` checks your Node version, that `claude` is on PATH, that secretlint is installed, that husky + lint-staged are wired, and that the installation looks healthy. Exits 0 when clean.

## Seed from existing docs

If you're installing into a repo that already has READMEs, ADRs, or module docs, you can seed the knowledge base from them in one of two ways.

### Supervised, from a Claude Code session

```
/kb-bootstrap                      # scans docs/ and root *.md
/kb-bootstrap docs/architecture    # scope to a path
```

The `kb-bootstrap` skill surveys your markdown, splits content into `practice` and `map` nodes, and writes them directly under `.ai/knowledge-base/nodes/`. It is judgmental, not exhaustive: it samples, follows cross-references, and stops to ask you when scope is unclear. Existing nodes are never overwritten; collisions are skipped and reported. Review with `git diff nodes/` and commit the ones you want.

Use this for the first pass. You stay in the loop and can correct it in flight.

### Headless, hash-aware re-runs

```sh
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/
```

This spawns `claude -p` under the hood, chunks the candidate docs in batches of 20, and writes nodes deterministically. It records each doc's SHA-256 in `.ai/knowledge-base/.state/bootstrap-state.json`, so re-runs only reprocess docs that changed. Same conservative collision behavior as the skill.

Useful options:

- `--include <glob>` / `--exclude <glob>`: scope which markdown to consider.
- `--dry-run`: list what would be processed without calling the model.

Do not run `bootstrap-incremental` in CI. It spawns the model and produces changes that still need human review.

## Upgrading

When a new version of the package ships:

```sh
npm install --save-dev @e0ipso/ai-knowledge-base@latest
npx @e0ipso/ai-knowledge-base init --assistants claude --upgrade
npx @e0ipso/ai-knowledge-base doctor
```

`--upgrade` refreshes hooks, skills, and bundled prompts but preserves your project config and any local prompt overrides. Add `--dry-run` to preview.
