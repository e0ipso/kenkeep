---
title: CLI reference
nav_order: 5
---

# CLI reference

The `ai-knowledge-base` binary is available after install (or run via `npx`).

## `init`

```sh
npx @e0ipso/ai-knowledge-base init --assistants claude [--force] [--upgrade]
```

First-time setup. Writes the knowledge-base scaffold (`.ai/knowledge-base/`), Claude hooks and skills (under `.claude/`), and a managed `.gitignore` block for the runtime state files. Does not patch `package.json` and does not install any commit-time tooling (husky, lint-staged, secretlint, commitlint); see [Installation → Optional commit-time hardening](installation.md#optional-commit-time-hardening) if you want those.

- `--force`: overwrite existing template files (never touches your project config).
- `--upgrade`: refresh templates and skills while preserving `config.yaml` and local prompt overrides.

## `doctor`

```sh
npx @e0ipso/ai-knowledge-base doctor [--verbose]
```

Checks Node version, that `claude` is on PATH, that the Claude hooks are registered in `.claude/settings.json`, that `.ai/knowledge-base/.state/installed-version` matches the installed package, settings validity, INDEX freshness, and dangling node references. Exits 0 when there are no errors.

## `status`

```sh
npx @e0ipso/ai-knowledge-base status
```

Prints pending work: queued captures, pending session logs, pending curator conflicts, current node counts.

## `curate`

```sh
npx @e0ipso/ai-knowledge-base curate [--batch-size <n>] [--timeout <ms>]
```

Run the curator over all session logs that have been processed but not yet curated. The curator writes new node files directly to `nodes/<kind>/<id>.md` for `add` actions and overwrites the target file for `modify` actions. `contradict` actions are written as one markdown file per conflict under `.ai/knowledge-base/conflicts/<run-id>-<n>.md` (with frontmatter `status: pending` and a body containing the rationale plus the proposed node); the `/kb-curate` skill walks each pending file with the user in-session. Review the resulting changes with `git diff` and let the skill drive conflict resolution.

## `node add`

```sh
npx @e0ipso/ai-knowledge-base node add \
  [--kind <practice|map>] [--title <text>] [--summary <text>] \
  [--tags <list>] [--relates-to <list>] [--confidence <low|medium|high>] \
  [--body <text|@->] [--yes]
```

Create a node manually. With no flags, prompts for every field. When `--kind`, `--title`, `--summary`, and `--body` are all supplied, runs non-interactively; partial flags prompt only for the missing fields. `--yes` skips the confirmation step and errors loud if any required field is missing. `--body @-` reads the body from stdin so multi-line markdown does not need shell escaping. Writes directly to `.ai/knowledge-base/nodes/<kind>/<id>.md`; fails loud on slug collision. Review with `git diff` and commit to accept.

## `bootstrap-incremental`

```sh
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from <path> \
  [--include <glob>] [--exclude <glob>] \
  [--dry-run] [--timeout <ms>]
```

Deterministic, hash-aware bootstrap from existing markdown docs. Skips files whose content hasn't changed since the last run.

## `index rebuild`

```sh
npx @e0ipso/ai-knowledge-base index rebuild [--stage]
```

Regenerate `INDEX.md` and `GRAPH.md` from `nodes/`. No LLM. Run after hand-edits or rebases.

`--stage` runs `git add` on the regenerated `INDEX.md`/`GRAPH.md` after writing. Intended to be called from a project's own pre-commit hook so freshly regenerated index files land in the same commit as any `nodes/` change (see [Installation → Optional commit-time hardening](installation.md#optional-commit-time-hardening) for a sample `.lintstagedrc.cjs` snippet). Skips the regen entirely (and stages nothing) when the recorded `nodes_hash` already matches the live tree. No-ops gracefully outside a git repo.

## `logs prune`

```sh
npx @e0ipso/ai-knowledge-base logs prune
```

Walks `_logs/` recursively and deletes `*.jsonl` files older than `settings.logsRetentionDays` (default 30). Prints `pruned N files`.

## Project settings

Project-level settings live in `.ai/knowledge-base/config.yaml` (committed). The file is strict: unknown keys cause a hard error naming the offending file.

```yaml
schema_version: 2
curationThreshold: 5
logsRetentionDays: 30
lintEveryNSessions: 50
```

| Key | Default | What it does |
|---|---|---|
| `curationThreshold` | `5` | Pending logs that trigger the curate nudge. |
| `logsRetentionDays` | `30` | Retention window applied by `logs prune`. |
| `lintEveryNSessions` | `50` | Run cadence for the background lint, in SessionEnd ticks. |

### Model and effort selection

Three optional config keys pick the `claude` model family and effort level for each `claude -p` subprocess. Each takes a `{ name, effort }` object; both sub-keys are required when the object is present. When a key is unset, the spawn omits both flags and the user's `claude` CLI default is used.

```yaml
proposalModel:
  name: haiku
  effort: low
curatorModel:
  name: opus
  effort: max
bootstrapModel:
  name: sonnet
  effort: high
```

| Key | Sub-key | Accepted values | Effect |
|---|---|---|---|
| `proposalModel` | `name` | `haiku`, `sonnet`, `opus` | Passed as `--model` on proposal drain spawns. |
| `proposalModel` | `effort` | `low`, `medium`, `high`, `xhigh`, `max` | Passed as `--effort` on proposal drain spawns. |
| `curatorModel` | `name` | `haiku`, `sonnet`, `opus` | Passed as `--model` on `curate` spawns. |
| `curatorModel` | `effort` | `low`, `medium`, `high`, `xhigh`, `max` | Passed as `--effort` on `curate` spawns. |
| `bootstrapModel` | `name` | `haiku`, `sonnet`, `opus` | Passed as `--model` on `bootstrap-incremental` spawns. |
| `bootstrapModel` | `effort` | `low`, `medium`, `high`, `xhigh`, `max` | Passed as `--effort` on `bootstrap-incremental` spawns. |

If a key is absent, neither flag is passed and the user's `claude` CLI default applies. The `/kb-bootstrap` skill is agent-driven (it spawns a sub-agent via the `Task` tool, not `claude -p`); it honors `bootstrapModel.name` on a best-effort basis but ignores `bootstrapModel.effort` because the `Task` tool has no `effort` parameter.

## Slash commands (Claude Code)

After `init --assistants claude`, three skills are available inside a session:

| Command | Equivalent |
|---|---|
| `/kb-curate` | `npx @e0ipso/ai-knowledge-base curate` |
| `/kb-add` | `npx @e0ipso/ai-knowledge-base node add` |
| `/kb-bootstrap [path]` | (no CLI equivalent, agent-driven) |
