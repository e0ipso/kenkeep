---
title: Installation
nav_order: 3
---

# Installation

## Prerequisites

- Node.js 22+
- One of the supported AI harnesses:
  - [Claude Code CLI](https://docs.claude.com/en/docs/claude-code/getting-started), or
  - [OpenAI Codex CLI](https://developers.openai.com/codex/cli/), or
  - [OpenCode CLI](https://opencode.ai/)

No API key required for any of these. The tool spawns the harness's own headless driver (`claude -p`, `codex exec`, or `opencode run`) and inherits whatever auth that CLI already uses. A `package.json` is no longer required at the repo root; `init` does not patch your project manifest.

## Claude Code

In the root of your repository:

```sh
npx @e0ipso/ai-knowledge-base init --harnesses claude
npx @e0ipso/ai-knowledge-base doctor
```

This creates / updates:

- `.ai/knowledge-base/`: your knowledge base scaffold (nodes, INDEX, GRAPH, state, config, prompt overrides).
- `.claude/`: hooks and skills used by Claude Code.
- A managed block in `.gitignore` for the runtime state files (`_sessions/`, `_logs/`, `state.json`, `bootstrap-state.json`).

`init` does **not** install husky, lint-staged, secretlint, commitlint, or any other commit-time tooling. If you want those, wire them up yourself (see [Optional: commit-time hardening](#optional-commit-time-hardening) below).

The Claude adapter wires capture on three lifecycle events: `Stop`, `SessionEnd`, and `PreCompact`.

### Verify

`npx @e0ipso/ai-knowledge-base doctor` checks your Node version, that `claude` is on PATH, that the Claude hooks are registered, that the installed-version marker is present, and that INDEX is fresh. Exits 0 when clean.

## Codex CLI

In the root of your repository:

```sh
npx @e0ipso/ai-knowledge-base init --harnesses codex
npx @e0ipso/ai-knowledge-base --harness codex doctor
```

This creates / updates:

- `.ai/knowledge-base/`: your knowledge base scaffold (same layout as the Claude install).
- `.codex/hooks.json`: the Codex hook registration file; entries we own are tagged by command prefix and refreshed on `init --upgrade`. User-authored entries in the same file are preserved.
- `.codex/hooks/`: the hook scripts (`kb-capture.mjs`, `kb-session-start.mjs`, `kb-proposal-drain.mjs`, `kb-lint-tick.mjs`).
- `.agents/skills/`: the `kb-add`, `kb-bootstrap`, and `kb-curate` skills. Codex reads skills from this shared location instead of a harness-specific subdirectory.
- A managed block in `.gitignore` for the runtime state files.

If your `.codex/config.toml` already defines its own `[hooks]` table, `init` refuses to write `.codex/hooks.json` and points you at [`codex-toml-hooks-coexistence.md`](installation/codex-toml-hooks-coexistence.md) for the manual merge procedure. We do not auto-merge because round-tripping TOML loses comments and whitespace.

### The `--harness <id>` flag

Every CLI subcommand accepts a global `--harness <id>` flag (`claude`, `codex`, or `opencode`). Inside an active Claude session the detector picks Claude automatically; Codex and OpenCode export no in-session env var, so when running outside an active session or from inside a Codex/OpenCode session you must pass `--harness` explicitly or set `cliDefaultHarness` in `.ai/knowledge-base/config.yaml`. Example:

```sh
npx @e0ipso/ai-knowledge-base --harness codex doctor
npx @e0ipso/ai-knowledge-base --harness codex curate
```

### Capture-event gap

Codex emits a `Stop` event at the end of every assistant turn but does not emit `SessionEnd` or `PreCompact`. The Codex adapter therefore wires capture and the lint tick to `Stop` only. The practical consequence: a single Codex session contributes one rolling capture (overwritten on each Stop) instead of one capture per session-end plus a pre-compaction safety net. Curation, conflict resolution, and review are unchanged.

### Verify

```sh
npx @e0ipso/ai-knowledge-base --harness codex doctor
```

Checks your Node version, that `codex` is on PATH, that `.codex/hooks.json` is registered with our entries, and that INDEX is fresh.

## OpenCode CLI

In the root of your repository:

```sh
npx @e0ipso/ai-knowledge-base init --harnesses opencode
npx @e0ipso/ai-knowledge-base --harness opencode doctor
```

This creates / updates:

- `.ai/knowledge-base/`: your knowledge base scaffold (same layout as the Claude install).
- `.opencode/plugins/kb.mjs`: a small TS plugin shim that subscribes to the OpenCode runtime event bus and dispatches each event to a per-event Node script. Self-registering by virtue of its location: OpenCode auto-loads every plugin under `.opencode/plugins/` at startup.
- `.opencode/kb-hooks/`: the per-event scripts (`kb-capture.mjs`, `kb-session-start.mjs`, `kb-proposal-drain.mjs`, `kb-lint-tick.mjs`). The plugin spawns these with stdin payloads matching the contract Claude and Codex use.
- `.opencode/skills/`: the `kb-add`, `kb-bootstrap`, and `kb-curate` skills. The bytes are identical to the bytes Claude installs at `.claude/skills/` and Codex installs at `.agents/skills/` (see [Shared skill source](#shared-skill-source)).
- A managed block in `.gitignore` for the runtime state files.

### Transcript discovery

OpenCode's hook payload does not carry a `transcript_path`. The capture hook reads `${XDG_DATA_HOME:-$HOME/.local/share}/opencode/storage/` on disk: it parses `session/<projectID>/<sessionID>.json`, walks `message/<sessionID>/*.json` ordered by `time.created`, and concatenates the text parts under `part/<messageID>/`. If the on-disk parse yields zero turns (e.g. because OpenCode has not finished flushing the session), the hook falls back to spawning `opencode export <sessionID>` (30-second timeout) and parses its JSON output through the same shape adapter.

### Capture-event gap

OpenCode's idiomatic events are `session.created` and `session.idle`. The OpenCode adapter wires capture and the lint tick to `session.idle` and the session-start payload to `session.created`. OpenCode has no v1 equivalent of Claude's `SessionStart` `additionalContext` stdout channel, so the session-start hook writes the current INDEX body to `.opencode/AGENTS.md`; users opt in by referencing that file from their primary `AGENTS.md`.

### No in-session env detection

OpenCode does not export an env var our detector can rely on, so the harness identity must be passed in. Either pass `--harness opencode` to every CLI invocation, set `cliDefaultHarness: opencode` in `.ai/knowledge-base/config.yaml` so plain-shell invocations resolve to OpenCode, or rely on the SKILL.md detect-harness recipe inside skills (the LLM author passes `--hint opencode` when materializing `/tmp/kb-detect-harness.mjs`).

### Verify

```sh
npx @e0ipso/ai-knowledge-base --harness opencode doctor
```

Checks your Node version, that `opencode` is on PATH, that `.opencode/plugins/kb.mjs` carries our package marker, that all four `.opencode/kb-hooks/*.mjs` scripts are present, and that the shared skills are installed at `.opencode/skills/`.

## Shared skill source

All three harnesses install the same `kb-add`, `kb-bootstrap`, and `kb-curate` SKILL.md bytes under their respective native skills directories (`.claude/skills/`, `.agents/skills/`, `.opencode/skills/`). The skill body resolves the active `--harness` value at runtime via a tiny `/tmp/kb-detect-harness.mjs` helper that the SKILL.md body materializes from a heredoc on first invocation. The LLM author substitutes its own best-guess id for the `<hint>` placeholder; the script validates the hint against the registered ids and walks the env / `cliDefaultHarness` chain on misses.

### Claude permission story

The shared SKILL.md drops the per-harness `allowed-tools` frontmatter (the field is Claude-specific and would otherwise require per-install rewriting). Claude users wanting the prior pre-approval ergonomics can add the line to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npx @e0ipso/ai-knowledge-base:*)"
    ]
  }
}
```

That covers every CLI subcommand (`curate`, `bootstrap-incremental`, `node add`, `index rebuild`, ...) and grants the equivalent permissions without needing the per-skill frontmatter.

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
npx @e0ipso/ai-knowledge-base init --harnesses claude --upgrade
npx @e0ipso/ai-knowledge-base doctor
```

`--upgrade` refreshes hooks, skills, and bundled prompts but preserves your project config and any local prompt overrides. Add `--dry-run` to preview.
