---
title: CLI reference
nav_order: 5
---

# CLI reference

The `ai-knowledge-base` binary is available after install (or run via `npx`). Every workflow on this page is also available as an in-harness skill — see [Skills](#skills) below. **Prefer the skills for interactive work**; the CLI is for CI, scripts, and headless re-runs.

## `--harness <id>` (global)

Selects the adapter (`claude`, `codex`, `cursor`, `opencode`). Inherited by every subcommand. Auto-detected via `CLAUDECODE=1` (Claude) and `CURSOR_VERSION` (Cursor). Codex and OpenCode have no env var, so pass `--harness` explicitly or set `cliDefaultHarness` in `config.yaml`.

```sh
npx @e0ipso/ai-knowledge-base --harness codex doctor
```

## Commands

### `init`

```sh
npx @e0ipso/ai-knowledge-base init --harnesses <id[,id,...]> [--upgrade]
```

First-time setup. Writes the KB scaffold, per-harness hooks/skills, and a managed `.gitignore` block. `--upgrade` refreshes templates while preserving `config.yaml` and local prompt overrides.

### `doctor [--verbose]`

Checks Node version, harness CLI on PATH, hooks registered, installed-version marker, INDEX freshness, dangling node references. Exits 0 when clean.

### `status`

Prints queued captures, pending session logs, pending curator conflicts, node counts.

### `curate [--batch-size <n>] [--timeout <ms>]`

Runs the curator over pending session logs. `add` and `modify` apply to `nodes/` directly; `contradict` writes one file per conflict under `conflicts/`. Use `/kb-curate` from a session to also get the conflict walkthrough.

### `node add [flags]`

Create a node manually. With no flags, prompts for every field. Flags:

```
--kind <practice|map>  --title <text>  --summary <text>
--tags <list>          --relates-to <list>  --confidence <low|medium|high>
--body <text|@->       --yes
```

`--body @-` reads from stdin. `--yes` skips confirmation and errors on missing required fields. Writes to `nodes/<kind>/<id>.md`; fails on slug collision.

### `bootstrap-incremental --from <path> [--include <glob>] [--exclude <glob>] [--dry-run]`

Hash-aware bootstrap from markdown docs. Skips files whose content hasn't changed since the last run.

### `index rebuild [--stage]`

Regenerate `INDEX.md` and `GRAPH.md` from `nodes/`. No LLM. `--stage` runs `git add` afterward (for pre-commit hooks); skips entirely when the tree already matches.

### `logs prune`

Deletes `_logs/**/*.jsonl` older than `logsRetentionDays` (default 30).

## Project settings — `.ai/knowledge-base/config.yaml`

Committed, strict (unknown keys are a hard error):

```yaml
schema_version: 1
curationThreshold: 5          # pending logs that trigger the nudge
logsRetentionDays: 30         # retention for `logs prune`
lintEveryNSessions: 50        # background lint cadence
cliDefaultHarness: codex      # fallback when no --harness and no env detection
```

### Model + effort per pipeline (optional)

Each of the three `claude -p` subprocess sites can pick a model and effort. Omit a key to use the user's `claude` CLI default.

```yaml
proposalModel:  { name: haiku, effort: low }     # proposal-drain hook
curatorModel:   { name: opus,  effort: max }     # `curate` CLI
bootstrapModel: { name: sonnet, effort: high }   # `bootstrap-incremental` CLI
```

`name` ∈ `haiku | sonnet | opus`. `effort` ∈ `low | medium | high | xhigh | max`. Both sub-keys are required when the object is present. The `/kb-bootstrap` skill (agent-driven via `Task`) honors `bootstrapModel.name` but ignores `effort`.

## Skills

All four harnesses install the same three skills. **Recommended entry points for interactive work** — they do strictly more than the bare CLI in two of three cases:

| Skill | CLI counterpart | Relationship |
|---|---|---|
| `/kb-add` | `node add` | **Parity.** Skill is a conversational wrapper that gathers fields, checks INDEX for overlap, then invokes the CLI. |
| `/kb-curate` | `curate` | **Skill ⊃ CLI.** The CLI writes `add`/`modify` to `nodes/`; `contradict` actions stop at `conflicts/<id>.md` with `status: pending`. The skill is what walks each conflict (`y/n/s/k`) and applies the choice. The bare CLI is fine for CI / batch runs where you'll resolve later. |
| `/kb-bootstrap [path]` | `bootstrap-incremental --from <path>` | **Different mechanisms.** Skill is agent-driven, supervised, sampling. CLI spawns its own headless `claude -p` and is hash-aware/exhaustive. Use the skill for the first pass; use the CLI for incremental re-runs after editing docs. |

Skill authors writing their own KB skills should not hardcode `--harness` — see [Internals → Adapters](internals/architecture.md#adapter-interface) for the detect-harness recipe.
