---
title: CLI commands
parent: Reference
nav_order: 1
---

# CLI commands

After install, the `ai-knowledge-base` binary is available (or via `npx`).

## `init`

```sh
ai-knowledge-base init --assistants <list> [--force] [--upgrade [--dry-run]]
```

First-time setup. Writes `.ai/knowledge-base/` scaffolding, `.claude/` skills and hooks, `.pre-commit-config.yaml` (if missing), and `.gitignore` block. Stamps `installed-version`.

Flags:

- `-a, --assistants <list>` (required): comma list. v1 supports `claude`.
- `-f, --force`: overwrite existing files. Never overwrites `.config.json`. Incompatible with `--upgrade`.
- `-u, --upgrade`: refresh templates while preserving customizations. See [Upgrading](../getting-started/upgrading.md).
- `--dry-run`: only meaningful with `--upgrade`.

## `doctor`

```sh
ai-knowledge-base doctor [--verbose]
```

Checks: Node 22+, `claude` and `gitleaks` on PATH, `installed-version` marker, pre-commit config, gitignore block, settings file validity, INDEX freshness, dangling `derived_from`.

Exits 0 if there are no errors. Warnings are allowed.

## `status`

```sh
ai-knowledge-base status
```

Print pending work: queue depth, pending session logs, pending proposals, current node counts.

## `curate`

```sh
ai-knowledge-base curate [--batch-size <n>] [--token-budget <n>] [--timeout <ms>]
```

Run the curator over every stage-2-done, not-yet-curated session log. Acquires the `curator` lock, batches logs, spawns `claude -p` per batch, writes proposals, regenerates INDEX/GRAPH, stamps `curator_processed_at` on each log.

Flags: `--batch-size` (default 10), `--token-budget` (default 50000), `--timeout` (default 120000).

Contradictions always carry `suggested_resolution: null`.

## `node add`

```sh
ai-knowledge-base node add
```

Interactive prompt for `kind`, `title`, `summary`, `tags`, `relates_to`, `confidence`, `body`. Writes to `_proposed/additions/` with `proposal.rationale: "manual"`, then regenerates INDEX/GRAPH.

Same path as the in-session `/kb-add` skill.

## `proposals review`

```sh
ai-knowledge-base proposals review [--list]
```

Interactive TUI over every pending proposal. Additions/modifications: accept (move to `nodes/<kind>/`) or reject. Contradictions: pick `supersede`, `keep_both`, or `reject` first, then accept. `supersede` updates the target node's `valid_until` and `superseded_by`.

`--list` prints pending proposals and exits.

## `bootstrap-incremental`

```sh
ai-knowledge-base bootstrap-incremental --from <path> \
  [--include <glob>] [--exclude <glob>] \
  [--dry-run] [--token-budget <n>] [--timeout <ms>]
```

Hash-aware doc bootstrapper. See [Bootstrap > Incremental](../bootstrap/incremental-bootstrap.md).

## `index rebuild`

```sh
ai-knowledge-base index rebuild [--budget-tokens <n>]
```

Regenerate `INDEX.md` and `GRAPH.md` from `nodes/`. Deterministic, no LLM. Use after hand-edits or rebases. The curator and `node add` regenerate them automatically.

`--budget-tokens` (default 2000) sets the INDEX trim budget. GRAPH is always unfiltered.

## `logs prune`

```sh
ai-knowledge-base logs prune [--older-than <duration>] [--dry-run]
```

Delete JSONL files under `_logs/{stage-2,curator,bootstrap-incremental}/` older than the cutoff. `--older-than` accepts `30d`, `2w`, `12h`, `45m`, `30s`, `500ms`, `1y`. Defaults to `<settings.logsRetentionDays>d` (30d).

Example output:

```
• Deleted 12 log file(s) older than 30d (2026-04-11T10:00:00.000Z).
  • stage-2: 8/14 eligible — 4.2 MB
  • curator: 3/9 eligible — 1.1 MB
  • bootstrap-incremental: 1/2 eligible — 220 KB

✓ freed 5.5 MB across 3 bucket(s).
```
