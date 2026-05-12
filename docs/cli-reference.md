---
title: CLI reference
nav_order: 5
---

# CLI reference

The `ai-knowledge-base` binary is available after install (or run via `npx`).

## `init`

```sh
ai-knowledge-base init --assistants claude [--force] [--upgrade [--dry-run]]
```

First-time setup. Writes the knowledge-base scaffold, Claude hooks and skills, the commit-time secret-scan scaffold (`.secretlintrc.json`, `.husky/pre-commit`, `.lintstagedrc.cjs`, plus devDeps and a `prepare: husky` script in `package.json`), and a managed `.gitignore` block. The `.lintstagedrc.cjs` runs secretlint on every staged file and `ai-knowledge-base index rebuild --stage` whenever a file under `.ai/knowledge-base/nodes/` is staged. Requires a `package.json` at the repo root.

- `--force` — overwrite existing files (never touches your project config).
- `--upgrade` — refresh templates while preserving customizations. Pair with `--dry-run` to preview.

## `doctor`

```sh
ai-knowledge-base doctor [--verbose]
```

Checks Node version, that `claude` is on PATH, that secretlint resolves in `node_modules`, that the commit-time scan is wired (`.husky/pre-commit`, `.lintstagedrc.cjs`, `.secretlintrc.json`), settings validity, INDEX freshness, and dangling references. Exits 0 when there are no errors.

## `status`

```sh
ai-knowledge-base status
```

Prints pending work: queued captures, pending session logs, pending curator conflicts, current node counts.

## `curate`

```sh
ai-knowledge-base curate [--batch-size <n>] [--token-budget <n>] [--timeout <ms>]
```

Run the curator over all session logs that have been processed but not yet curated. The curator writes new node files directly to `nodes/<kind>/<id>.md` for `add` actions and overwrites the target file for `modify` actions. `contradict` actions are recorded in `.ai/knowledge-base/.state/pending-conflicts.json` for the `/kb-curate` skill to resolve in-session with the user. Review the resulting changes with `git diff nodes/`.

## `node add`

```sh
ai-knowledge-base node add
```

Interactive prompt to create a node manually. Writes directly to `.ai/knowledge-base/nodes/<kind>/<id>.md`. Fails loud if a node with that id already exists. Review with `git diff` and commit to accept.

## `bootstrap-incremental`

```sh
ai-knowledge-base bootstrap-incremental --from <path> \
  [--include <glob>] [--exclude <glob>] \
  [--dry-run] [--token-budget <n>] [--timeout <ms>]
```

Deterministic, hash-aware bootstrap from existing markdown docs. Skips files whose content hasn't changed since the last run.

## `index rebuild`

```sh
ai-knowledge-base index rebuild [--budget-tokens <n>] [--stage]
```

Regenerate `INDEX.md` and `GRAPH.md` from `nodes/`. No LLM. Run after hand-edits or rebases.

`--stage` runs `git add` on the regenerated `INDEX.md`/`GRAPH.md` after writing. Used by the `lint-staged` pre-commit hook (configured by `init` in `.lintstagedrc.cjs`) so the freshly regenerated index files land in the same commit as any `nodes/` change. Skips the regen entirely (and stages nothing) when the recorded `nodes_hash` already matches the live tree. No-ops gracefully outside a git repo.

## `logs prune`

```sh
ai-knowledge-base logs prune [--older-than <duration>] [--dry-run]
```

Delete old run logs under `_logs/`. `--older-than` accepts forms like `30d`, `2w`, `12h`, `45m`. Defaults to 30 days (configurable via `logsRetentionDays`).

## Project settings

Project-level settings live in `.ai/knowledge-base/.config.json` (committed). A user-level file at `~/.config/@e0ipso/ai-knowledge-base/config.json` can set personal defaults; the project file wins.

```json
{
  "schema_version": 1,
  "drainBound": 5,
  "stage2Timeout": 60000,
  "indexBudgetTokens": 2000,
  "curationThreshold": 5,
  "bootstrapTokenBudget": 10000,
  "logsRetentionDays": 30
}
```

| Key | Default | What it does |
|---|---|---|
| `drainBound` | `5` | Max background extractions processed per session start. |
| `stage2Timeout` | `60000` | Per-entry extraction timeout (ms). |
| `indexBudgetTokens` | `2000` | Token budget for `INDEX.md`. |
| `curationThreshold` | `5` | Pending logs that trigger the curate nudge. |
| `bootstrapTokenBudget` | `10000` | Per-batch budget for `bootstrap-incremental`. |
| `logsRetentionDays` | `30` | Default window for `logs prune`. |

CLI flags override settings per run.

## Slash commands (Claude Code)

After `init --assistants claude`, three skills are available inside a session:

| Command | Equivalent |
|---|---|
| `/kb-curate` | `ai-knowledge-base curate` |
| `/kb-add` | `ai-knowledge-base node add` |
| `/kb-bootstrap [path]` | (no CLI equivalent — agent-driven) |
