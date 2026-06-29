---
title: Installation
nav_order: 3
---

# Installation

## Prerequisites

- Node.js 22+
- One of the supported AI harnesses on PATH: [Claude Code](https://docs.claude.com/en/docs/claude-code/getting-started), [Codex CLI](https://developers.openai.com/codex/cli/), [Cursor](https://cursor.com/docs) (agent CLI), [OpenCode](https://opencode.ai/), or [GitHub Copilot CLI](https://github.com/github/copilot) (`@github/copilot`).

No API key required. `init` spawns the harness's own headless driver (`claude -p`, `codex exec`, `agent -p`, `opencode run`, or `copilot -p`) and inherits whatever auth that CLI already uses. A `package.json` at the repo root is **not** required.

## Install

In your repo root:

```sh
npx kenkeep init --harnesses <id>
npx kenkeep --harness <id> doctor
```

`<id>` is one of `claude`, `codex`, `cursor`, `opencode`, `copilot`. Pass a comma-separated list to install several at once.

`init` creates:

- `.ai/kenkeep/`: knowledge base scaffold (nodes, INDEX, GRAPH, state, config, prompt overrides). Shared across harnesses.
- One harness-specific hook + skills directory (`.claude/`, `.codex/` + `.agents/skills/`, `.cursor/`, `.opencode/`, or `.copilot/` + `.github/skills/`).
- A managed block in `.gitignore` for runtime state.

`init` does **not** install husky, lint-staged, secretlint as devDeps, or commitlint. See [Optional: commit-time hardening](#optional-commit-time-hardening) below if you want them.

## Per-harness notes

The CLI auto-detects Claude (via `CLAUDECODE=1`) and Cursor (via `CURSOR_AGENT=1`). **Codex, OpenCode, and Copilot export no in-session env var**, so when invoking from outside a session, or from inside a Codex/OpenCode/Copilot session, pass `--harness <id>` explicitly, or set `cliDefaultHarness` in `.ai/kenkeep/config.yaml`.

| Harness | Capture events | Prompt-time injection | Notable |
|---|---|---|---|
| Claude | `Stop`, `SessionEnd`, `PreCompact` | ✅ `UserPromptSubmit` | Writes a fence-managed pointer to `AGENTS.md`. Claude Code auto-loads `CLAUDE.md`, not `AGENTS.md`; see [AGENTS.md and CLAUDE.md](#agentsmd-and-claudemd) below. |
| Codex | `Stop`, `PreCompact` | ✅ `UserPromptSubmit` | A pre-existing `[hooks]` table in `.codex/config.toml` makes `init` refuse to write. See [coexistence](installation/codex-toml-hooks-coexistence.md). After first install, run `/hooks` inside a Codex session once to trust the kenkeep hook scripts before they will execute. |
| Cursor | `stop`, `sessionEnd`, `preCompact` | — | If Cursor's *Third-party skills* is on, don't also install the `claude` adapter, or you'll double-fire. INDEX injection via `sessionStart` is fire-and-forget; reference INDEX from `AGENTS.md` if it proves unreliable. |
| OpenCode | `session.idle`, `session.created` | — | No `additionalContext` channel. The session-start hook writes the entry catalog to `.opencode/AGENTS.md`, and `init` registers it in `.opencode/opencode.json`'s `instructions` array so OpenCode loads it natively (no manual reference needed; verified against opencode 1.17.3), alongside the `plugin` entry OpenCode requires to load the hooks. `.opencode/AGENTS.md` is per-user, regenerated every session — add it to your `.gitignore`, never commit it. |
| Copilot | `sessionEnd`, `agentStop` | — | Hooks register in the repo-level `.github/hooks/kk.json` (Copilot loads it before any user-level hooks). No `additionalContext` channel; the session-start hook writes INDEX into `.github/copilot-instructions.md` under a sentinel block. See [GitHub Copilot CLI](#github-copilot-cli) below. |

If your harness isn't listed above, this tool doesn't support it yet.

**Prompt-time injection** is a second, task-aware knowledge surface: after you submit a prompt, kenkeep ranks the current leaf nodes against it and injects a small, bounded list of the most relevant node summaries and links. It is available today only on the harnesses with a verified native prompt-submit context channel (Claude Code and Codex); the others continue to rely on session-start `ENTRY.md` orientation only. The injected entries are summaries-plus-links — open the linked node before relying on details. See [Internals → Hooks → Prompt-time injection](internals/hooks.md#kk-prompt-contextcjs-prompt-time-injection).

### AGENTS.md and CLAUDE.md

`kenkeep init --harnesses claude` writes a fence-managed `kk-index` pointer into a top-level `AGENTS.md`. The runtime catalog injection on `SessionStart` is driven by `.claude/hooks/kk-session-start.cjs`, so every new Claude session still receives `ENTRY.md` and the navigation directive regardless of what static files exist.

However, Claude Code itself does **not** auto-load `AGENTS.md` — it only auto-loads `CLAUDE.md` (and `CLAUDE.local.md`). If your repo already has a top-level `CLAUDE.md` and you want the `AGENTS.md` sentinel honored as a static pointer (for example, for code-review tools, other agents that share `AGENTS.md`, or anyone browsing the repo), import it at the top of `CLAUDE.md`:

```markdown
@AGENTS.md

# CLAUDE.md
[project-specific instructions]
```

See the upstream Claude Code memory docs for details: <https://code.claude.com/docs/en/memory.md>

### GitHub Copilot CLI

The Copilot adapter targets the agentic `@github/copilot` binary (the `copilot` command), not `gh copilot` and not the cloud Copilot Coding Agent.

**Prerequisites**: install the CLI with `npm i -g @github/copilot`, then run `copilot` once and complete `/login` interactively (or export a token via `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN`).

**Install**:

```sh
npx kenkeep init --harnesses copilot
npx kenkeep --harness copilot doctor
```

What `init` writes:

- `.copilot/kk-hooks/kk-{capture,session-start,proposal-drain,lint-tick}.cjs`: the adapter's hook scripts. `.copilot/` is a kenkeep-tool convention (Copilot itself does not read it); it mirrors `.claude/`, `.codex/`, and `.opencode/`.
- `.github/hooks/kk.json`: the per-event hook config Copilot actually reads. This is a **repo-level** file (Copilot loads `.github/hooks/*.json` before user-level `~/.copilot/hooks/`), so it is committed to the repo and shared by the team. `init` writes nothing outside the repository — no user-home mutation. If you previously ran an older `init` that wrote `~/.copilot/hooks/kk.json`, remove that file manually; otherwise Copilot will run both and fire every hook twice.
- `.github/skills/kk-{add,bootstrap,curate}/`: the shared skills, in Copilot's documented project skill location. This avoids colliding with `.claude/skills/` and `.agents/skills/` in mixed-harness installs.
- `.github/copilot-instructions.md`: the INDEX content under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block (see below).

**No in-session env detection**: Copilot exports no env var that identifies an active session, so selection always requires `--harness copilot`, `--hint copilot` (inside a skill), or `cliDefaultHarness: copilot` in `config.yaml`. For a Copilot-primary repo, set `cliDefaultHarness: copilot` so plain-shell `npx kenkeep` invocations resolve correctly.

**Headless model**: `curate`, `bootstrap`, and the background proposal drain spawn `copilot -p "<prompt>" --no-ask-user --allow-all-tools --add-dir <repo-root>`. Both `--no-ask-user` and `--allow-all-tools` are required for fully autonomous non-interactive operation. Copilot has no `--json` programmatic-output flag, so the runner parses the JSON payload the prompt instructs the model to emit at the end of its plain-text answer. Set the model in `config.yaml` (for example `claude-sonnet-4.5` if your account has access); omit it to use Copilot's default.

**Session-start context injection (known limitation)**: Copilot does not document a stdout context-injection channel on `sessionStart`. As a workaround, the session-start hook writes the current INDEX content into `.github/copilot-instructions.md` under a `<!-- kk:start --> ... <!-- kk:end -->` sentinel block, which Copilot reads on session start. The rewrite is idempotent and preserves any content you author outside the block. Leave the sentinel block intact to keep the injection active.

**Auth check is heuristic**: `doctor` reports auth as healthy when a GitHub token env var is set or `~/.copilot/settings.json` exists. It cannot fully validate auth without spawning a `copilot` subprocess, so it may warn falsely when you use a non-default `COPILOT_HOME`. Run `copilot` and complete `/login` if the warning fires unexpectedly.

**Advanced (not wired by this tool)**: Copilot's `preToolUse` hook supports a stdout `permissionDecision` contract that advanced users can use to enforce tool-restriction policies. This plan does not wire it.

### Claude permission shortcut

The shared SKILL.md does not carry per-tool `allowed-tools` frontmatter. To pre-approve every CLI subcommand under Claude, add to `.claude/settings.json`:

```json
{ "permissions": { "allow": ["Bash(npx kenkeep:*)"] } }
```

## Configuration

Project settings live in `.ai/kenkeep/config.yaml`. It is committed and strict: unknown keys are a hard error.

```yaml
schema_version: 1
curationThreshold: 20         # pending sessions that trigger the curate nudge
logsRetentionDays: 30         # retention for pruning diagnostic logs
lintEveryNSessions: 50        # background lint cadence
notifications:
  enabled: true               # set false to disable native OS notifications
cliDefaultHarness: codex      # harness to assume when none is detected
```

Actionable SessionStart nudges also attempt a native desktop notification by
default when a local backend is available: `osascript` on macOS and
`notify-send` on Linux. This is additive; the same nudge still goes through the
normal assistant/context channel. Missing binaries, denied OS permissions,
headless sessions, SSH, WSL, missing DBus, and unavailable notification daemons
are skipped silently. Set `notifications.enabled: false` to disable all OS
notification attempts. Network notification backends such as `ntfy` are not
enabled by this setting.

### Extraction model (optional)

On Codex, Cursor, OpenCode, and Copilot, candidate extraction runs in the background after each session via the harness's headless driver. You can set the model and effort it uses:

```yaml
proposalModel: { name: <model>, effort: <low|medium|high|xhigh|max> }
```

`name` is the harness's own model id. Both sub-keys are required when the object is present; omit it to use the harness default. This setting does not apply to Claude, where extraction runs inline while you curate, under your session's own model.

### Model and effort for curate and bootstrap

{% capture curate_cost_tip %}
`/kk-curate` and `/kk-bootstrap` run under whatever model your host harness session uses, so this cost is yours to tune. Both are structured classification tasks — explicit decision trees with inline examples, plus human review via `git commit`/`git restore` as a safety net — so a mid-tier model at moderate effort is sufficient. Higher-tier models cost significantly more for marginal gains on this workload; bootstrap can go lower still, since its input is structured docs rather than messy transcripts. Example configurations: Claude `sonnet` / `medium` effort, Codex `gpt-5-codex` / `low` reasoning effort.
{% endcapture %}
{% include callout.html variant="tip" title="Model cost tip" content=curate_cost_tip %}

## Optional: commit-time hardening

kenkeep does **not** scan or redact captured transcripts, and does nothing to protect commits. Secret hygiene is entirely yours. The two pieces teams most often add by hand:

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
  '.ai/kenkeep/nodes/**/*.md': () => ['npx kenkeep index rebuild --stage'],
};
```

Replace `.husky/pre-commit` with `npx lint-staged`. The `index rebuild --stage` step keeps `ENTRY.md`/`GRAPH.md` in lockstep with committed nodes (no-op when already current).

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

## Validate in CI

Validate what's committed; don't run the LLM pipelines (they need human review and a live harness):

```sh
npx kenkeep doctor --verbose
npx kenkeep index rebuild
git diff --exit-code .ai/kenkeep/ENTRY.md .ai/kenkeep/GRAPH.md
```

{% include callout.html variant="note" content="The `git diff --exit-code` line fails the build when a commit bypassed the pre-commit hook, leaving `ENTRY.md`/`GRAPH.md` out of sync with `nodes/`." %}

## Seed from existing docs

Inside a harness session:

```
/kk-bootstrap [path]
```

Surveys your markdown, splits into `practice` and `map` nodes, writes under `nodes/`. Hash-aware: only reprocesses docs whose SHA-256 changed since the last run. Existing nodes are never overwritten. Review the written files: accept by leaving them in place, reject by deleting them. Don't seed from CI: `/kk-bootstrap` drives the LLM and its output needs human review.

## Upgrading

```sh
npm install --save-dev kenkeep@latest
npx kenkeep init --harnesses <id> --upgrade
npx kenkeep --harness <id> doctor
```

`--upgrade` refreshes hooks, skills, and bundled prompts; preserves your `config.yaml` and local prompt overrides.
