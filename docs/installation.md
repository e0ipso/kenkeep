---
title: Installation
nav_order: 3
---

# Installation

## Prerequisites

- Node.js 22+
- [Claude Code CLI](https://docs.claude.com/en/docs/claude-code/getting-started)

No Anthropic API key required. The tool uses `claude -p` and inherits your existing Claude Code auth. A `package.json` is no longer required at the repo root; `init` does not patch your project manifest.

## Install

In the root of your repository:

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude
npx @e0ipso/ai-knowledge-base doctor
```

This creates / updates:

- `.ai/knowledge-base/`: your knowledge base scaffold (nodes, INDEX, GRAPH, state, config, prompt overrides).
- `.claude/`: hooks and skills used by Claude Code.
- A managed block in `.gitignore` for the runtime state files (`_sessions/`, `_logs/`, `state.json`, `bootstrap-state.json`).

`init` does **not** install husky, lint-staged, secretlint, commitlint, or any other commit-time tooling. If you want those, wire them up yourself (see [Optional: commit-time hardening](#optional-commit-time-hardening) below).

## Verify

`npx @e0ipso/ai-knowledge-base doctor` checks your Node version, that `claude` is on PATH, that the Claude hooks are registered, that the installed-version marker is present, and that INDEX is fresh. Exits 0 when clean.

## Optional: commit-time hardening

The package only handles capture-time redaction (the `kb-capture.mjs` hook runs secretlint internally before writing a session log). It does not install any commit-time defense. The two hardening pieces teams most often add by hand:

### Commit-time secret scanner (secretlint)

Cheapest path: run it in CI on every push.

```yaml
# .github/workflows/secret-scan.yml
name: secret-scan
on: [pull_request, push]
jobs:
  secretlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx secretlint "**/*"
```

To run it locally before each commit instead:

```sh
npm install -D husky lint-staged secretlint @secretlint/secretlint-rule-preset-recommend
npx husky init
```

Then write `.secretlintrc.json`:

```json
{ "rules": [ { "id": "@secretlint/secretlint-rule-preset-recommend" } ] }
```

And `.lintstagedrc.cjs`:

```js
module.exports = {
  '*': ['secretlint'],
  '.ai/knowledge-base/nodes/**/*.md': () => ['npx @e0ipso/ai-knowledge-base index rebuild --stage'],
};
```

Replace the contents of `.husky/pre-commit` with `npx lint-staged`. The `index rebuild --stage` step is what keeps `INDEX.md`/`GRAPH.md` in lockstep with committed nodes; it is a no-op when the tree is already up to date.

### Commit message linting (commitlint)

Useful if your team enforces [Conventional Commits](https://www.conventionalcommits.org/).

```sh
npm install -D @commitlint/cli @commitlint/config-conventional
```

Write `commitlint.config.cjs`:

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

With husky already initialized, add `.husky/commit-msg` containing:

```sh
npx --no -- commitlint --edit "$1"
```

This repo's own `commitlint.config.cjs` adds project-specific rules (subject length caps, allowed types, a custom `no-ai-generated` rule); copy and trim as needed for your project.

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
