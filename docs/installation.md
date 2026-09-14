---
title: Installation
nav_order: 3
redirect_from:
  - /continuous-integration.html
  - /installation/codex-toml-hooks-coexistence.html
---

# Installation

## Prerequisites

- Node.js 22 or newer.
- One supported assistant on PATH: [Claude Code](https://docs.claude.com/en/docs/claude-code/getting-started), [Codex CLI](https://developers.openai.com/codex/cli/), [Cursor](https://cursor.com/docs) (agent CLI), [OpenCode](https://opencode.ai/), or [GitHub Copilot CLI](https://github.com/github/copilot).

No API key. Kenkeep runs inside the assistant you already pay for and inherits its login. The repo does not need a `package.json`.

## Install

In your repo root:

```sh
npx kenkeep init --harnesses <id>
npx kenkeep --harness <id> doctor
```

`<id>` is `claude`, `codex`, `cursor`, `opencode`, or `copilot`. Comma-separate several to install them all.

`init` writes three things:

- `.ai/kenkeep/`, the knowledge base: `nodes/`, `ENTRY.md`, `GRAPH.md`, `config.yaml`, prompt overrides, and the compiled hook scripts. One tree, shared by every harness.
- The harness's own hook registration and a copy of the skills, in the locations listed below.
- `.kkignore`, the scope for `/kk-bootstrap`, plus a fenced pointer block in `AGENTS.md`.

{% capture per_clone %}
Hook scripts under `.ai/kenkeep/hooks/` are gitignored. Commit everything else, and have each teammate run `init` once after cloning. Nothing is written outside the repo.
{% endcapture %}
{% include callout.html variant="note" content=per_clone %}

## Per-harness notes

| Harness | Capture fires on | Prompt-time injection | Registration and skills |
|---|---|---|---|
| Claude Code | `Stop`, `SessionEnd`, `PreCompact` | Yes | `.claude/settings.json`, `.claude/skills/` |
| Codex CLI | `Stop`, `PreCompact` | Yes | `.codex/hooks.json`, `.agents/skills/` |
| Cursor | `stop`, `sessionEnd`, `preCompact` | No | `.cursor/hooks.json`, `.cursor/skills/` |
| OpenCode | `session.idle` | No | `.opencode/opencode.json`, `.opencode/plugins/kk.mjs`, `.opencode/skills/` |
| Copilot CLI | `sessionEnd`, `agentStop` | No | `.github/hooks/kk.json`, `.github/skills/`, `.github/copilot-instructions.md` |

Kenkeep detects a running Claude Code or Cursor session from the environment. Codex, OpenCode, and Copilot export nothing it can read, so from those sessions, or from a plain shell, pass `--harness <id>` or set `cliDefaultHarness` in `config.yaml`.

**Claude Code** loads `CLAUDE.md`, not `AGENTS.md`. If you keep a `CLAUDE.md`, put `@AGENTS.md` on its first line so the pointer block is honored. To pre-approve every kenkeep command, add this to `.claude/settings.json`:

```json
{ "permissions": { "allow": ["Bash(npx kenkeep:*)"] } }
```

**Codex CLI** needs a one-time trust step. Run `/hooks` inside a Codex session and trust the kenkeep entries, or capture is skipped silently. If `.codex/config.toml` already has a `[hooks]` table, `init` refuses to write a second registration. Add one entry like this per pair below, then delete `.codex/hooks.json`:

```toml
[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "node ./.ai/kenkeep/hooks/codex/kk-capture.cjs"
timeout = 30
```

Pairs: `Stop` with `kk-capture.cjs` and `kk-lint-tick.cjs`, `PreCompact` with `kk-capture.cjs`, `SessionStart` with `kk-session-start.cjs` and `kk-proposal-drain.cjs`, `UserPromptSubmit` with `kk-prompt-context.cjs`.

**Cursor** with the third-party skills setting on should not also have the `claude` adapter installed, or every hook fires twice.

**OpenCode** has no context channel, so the session-start hook writes the catalog to `.opencode/AGENTS.md` and `init` registers it under `instructions`. That file is regenerated every session and `init` gitignores it.

**Copilot CLI** means the `@github/copilot` binary, not `gh copilot`. Install it, run `copilot` once, and complete `/login`. The catalog is written into `.github/copilot-instructions.md` between `<!-- kk:start -->` and `<!-- kk:end -->`. Leave that block in place and write your own instructions around it. An older `init` wrote `~/.copilot/hooks/kk.json`; delete it, or every hook fires twice.

## Configuration

Settings live in `.ai/kenkeep/config.yaml`, committed, and strict: an unknown key is an error.

```yaml
schema_version: 1
curationThreshold: 20      # captured sessions before the curate nudge fires
logsRetentionDays: 30      # what `logs prune` keeps
lintEveryNSessions: 50     # background lint cadence
notifications:
  enabled: true            # desktop notification with each actionable nudge
  backends: {}
cliDefaultHarness: codex   # harness to assume in a plain shell
```

Model choice is optional and keyed by harness. `proposalModel` covers background extraction on Codex, Cursor, OpenCode, and Copilot. `curatorModel` and `bootstrapModel` cover the `npx kenkeep curate` and `npx kenkeep bootstrap` launchers. Skills you run inside a session use that session's model.

```yaml
proposalModel: { harness: claude, name: sonnet, effort: medium }
proposalModel: { harness: codex, model: gpt-5-codex, reasoningEffort: low }
```

{% include callout.html variant="tip" title="Model cost" content="Curate and bootstrap are classification tasks with a human review behind them. A mid-tier model at moderate effort is enough. Bootstrap can go lower still because its input is structured docs, not transcripts." %}

## Seed from existing docs

Inside a session:

```
/kk-bootstrap [path]
```

It walks the markdown under `path` (default: repo root, filtered by `.kkignore`), writes notes under `nodes/`, and skips any doc whose content hash it has already processed. Existing notes are never overwritten. Review with `git diff` and commit what you want.

## Continuous integration

Kenkeep ships a read-only GitHub Actions workflow at [`examples/kenkeep-check.yml`](https://github.com/e0ipso/kenkeep/blob/main/examples/kenkeep-check.yml). Copy it to `.github/workflows/` in your repo:

```sh
mkdir -p .github/workflows
curl -fsSL https://raw.githubusercontent.com/e0ipso/kenkeep/main/examples/kenkeep-check.yml \
  -o .github/workflows/kenkeep-check.yml
```

On every PR that touches `.ai/kenkeep/`, it runs `lint`, `doctor`, `freshness`, and an index drift check, then posts one PR comment. It never runs an LLM, writes to `nodes/`, or commits. Keep `fetch-depth: 0`, because `freshness` reads git history and reports nothing on a shallow clone. Drop `cache: 'npm'` if your repo has no lockfile. Expect `doctor` to warn that no harness is installed on the runner.

## Commit-time hardening (optional)

Kenkeep does not scan transcripts for secrets. Captures are gitignored, but the notes you commit are yours to check. A common setup:

```sh
npm install -D husky lint-staged secretlint @secretlint/secretlint-rule-preset-recommend
npx husky init
```

`.lintstagedrc.cjs`:

```js
module.exports = {
  '*': ['secretlint'],
  '.ai/kenkeep/nodes/**/*.md': () => ['npx kenkeep index rebuild --stage'],
};
```

Point `.husky/pre-commit` at `npx lint-staged`. The second rule keeps `ENTRY.md` and `GRAPH.md` in the same commit as the notes that changed.

## Upgrading

```sh
npm install --save-dev kenkeep@latest
npx kenkeep init --harnesses <id> --upgrade
npx kenkeep --harness <id> doctor
```

`--upgrade` refreshes hooks, skills, and bundled prompts. It keeps your `config.yaml` and prompt overrides.
