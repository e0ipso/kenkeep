---
title: Installation
nav_order: 3
---

# Installation

## Prerequisites

- Node.js 22+
- One of the supported AI harnesses on PATH: [Claude Code](https://docs.claude.com/en/docs/claude-code/getting-started), [Codex CLI](https://developers.openai.com/codex/cli/), [Cursor](https://cursor.com/docs) (agent CLI), or [OpenCode](https://opencode.ai/).

No API key required. `init` spawns the harness's own headless driver (`claude -p`, `codex exec`, `agent -p`, or `opencode run`) and inherits whatever auth that CLI already uses. A `package.json` at the repo root is **not** required.

## Install

In your repo root:

```sh
npx @e0ipso/ai-knowledge-base init --harnesses <id>
npx @e0ipso/ai-knowledge-base --harness <id> doctor
```

`<id>` is one of `claude`, `codex`, `cursor`, `opencode`. Pass a comma-separated list to install several at once.

`init` creates:

- `.ai/knowledge-base/`: KB scaffold (nodes, INDEX, GRAPH, state, config, prompt overrides). Shared across harnesses.
- One harness-specific hook + skills directory (`.claude/`, `.codex/` + `.agents/skills/`, `.cursor/`, or `.opencode/`).
- A managed block in `.gitignore` for runtime state.

`init` does **not** install husky, lint-staged, secretlint as devDeps, or commitlint. See [Optional: commit-time hardening](#optional-commit-time-hardening) below if you want them.

## Per-harness notes

The CLI auto-detects Claude (via `CLAUDECODE=1`) and Cursor (via `CURSOR_VERSION`). **Codex and OpenCode export no in-session env var**, so when invoking from outside a session, or from inside a Codex/OpenCode session, pass `--harness <id>` explicitly, or set `cliDefaultHarness` in `.ai/knowledge-base/config.yaml`.

| Harness | Capture events | Notable |
|---|---|---|
| Claude | `Stop`, `SessionEnd`, `PreCompact` | (none) |
| Codex | `Stop` only | A pre-existing `[hooks]` table in `.codex/config.toml` makes `init` refuse to write. See [coexistence](installation/codex-toml-hooks-coexistence.md). |
| Cursor | `stop`, `sessionEnd`, `preCompact` | If Cursor's *Third-party skills* is on, don't also install the `claude` adapter, or you'll double-fire. INDEX injection via `sessionStart` is fire-and-forget; reference INDEX from `AGENTS.md` if it proves unreliable. |
| OpenCode | `session.idle` only | No `additionalContext` channel. The session-start hook writes INDEX to `.opencode/AGENTS.md`; reference that file from your primary `AGENTS.md`. |

If your harness isn't listed above, this tool doesn't support it yet.

### Claude permission shortcut

The shared SKILL.md does not carry per-tool `allowed-tools` frontmatter. To pre-approve every CLI subcommand under Claude, add to `.claude/settings.json`:

```json
{ "permissions": { "allow": ["Bash(npx @e0ipso/ai-knowledge-base:*)"] } }
```

## Optional: commit-time hardening

`kb-capture.mjs` redacts secrets in captured transcripts via secretlint. It does **not** protect commits. The two pieces teams most often add by hand:

### Secret scanning on commit

```sh
npm install -D husky lint-staged secretlint @secretlint/secretlint-rule-preset-recommend
npx husky init
```

`.secretlintrc.json`:
```json
{ "rules": [ { "id": "@secretlint/secretlint-rule-preset-recommend" } ] }
```

`.lintstagedrc.cjs`:
```js
module.exports = {
  '*': ['secretlint'],
  '.ai/knowledge-base/nodes/**/*.md': () => ['npx @e0ipso/ai-knowledge-base index rebuild --stage'],
};
```

Replace `.husky/pre-commit` with `npx lint-staged`. The `index rebuild --stage` step keeps `INDEX.md`/`GRAPH.md` in lockstep with committed nodes (no-op when already current).

Cheaper alternative: run `npx secretlint "**/*"` in CI on every push instead of locally.

### Conventional Commits (commitlint)

```sh
npm install -D @commitlint/cli @commitlint/config-conventional
```

`commitlint.config.cjs`:
```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

Add `.husky/commit-msg` with `npx --no -- commitlint --edit "$1"`.

## Seed from existing docs

```
/kb-bootstrap [path]           # in-session
```

```sh
npx @e0ipso/ai-knowledge-base bootstrap --from docs/   # CLI launcher, execs `<harness> -p "/kb-bootstrap --from docs/"`
```

Surveys your markdown, splits into `practice` and `map` nodes, writes under `nodes/`. Hash-aware: only reprocesses docs whose SHA-256 changed since the last run. Existing nodes are never overwritten. Review the written files: accept by leaving them in place, reject by deleting them. Don't run `bootstrap` in CI. It launches the host harness and the LLM-driven work needs human review.

## Upgrading

```sh
npm install --save-dev @e0ipso/ai-knowledge-base@latest
npx @e0ipso/ai-knowledge-base init --harnesses <id> --upgrade
npx @e0ipso/ai-knowledge-base --harness <id> doctor
```

`--upgrade` refreshes hooks, skills, and bundled prompts; preserves your `config.yaml` and local prompt overrides.
