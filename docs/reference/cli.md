---
title: CLI commands
parent: Reference
nav_order: 1
---

# CLI commands

The package installs an `ai-knowledge-base` binary. After `npm install -g @e0ipso/ai-knowledge-base` (or via `npx`), every subcommand documented below is available.

## `init`

```sh
ai-knowledge-base init --assistants <list> [--force]
```

First-time setup for a repo. Copies the directory skeleton, slash commands, hook scripts, and pre-commit config; registers the capture hook against three Claude Code events; writes `.ai/.kb-builder/installed-version`.

Flags:

- `-a, --assistants <list>` (required) — comma-separated list of AI assistants to wire up. v1 supports `claude` only; the list form exists for forward compatibility.
- `-f, --force` — overwrite existing files. Without this flag, re-running `init` on an already-initialized repo exits with a notice and does nothing.

What `init` writes:

- `.ai/knowledge-base/` — node directories, `_proposed/`, `_sessions/`, `_logs/`, plus an in-KB `README.md`, `INDEX.md`, and `GRAPH.md` stub.
- `.claude/commands/kb-bootstrap.md` — the bootstrap slash command body (other slash commands ship in M3).
- `.claude/hooks/kb-capture.mjs` — compiled stage-1 capture script (Stop / SessionEnd / PreCompact).
- `.claude/settings.json` — registers the three hooks; merges with any existing user-defined hooks.
- `.ai/.kb-builder/installed-version` — JSON marker recording the package version and selected assistants.
- `.ai/.kb-builder/prompts/` — copy of the shipped prompts so you can review or override them locally.
- `.gitignore` — appends a managed block listing `_sessions/`, `_logs/`, and state files.
- `.pre-commit-config.yaml` — gitleaks hook (only if no config exists; otherwise the file is left alone with a warning).

## `doctor`

```sh
ai-knowledge-base doctor [--verbose]
```

Verify the installation. Checks Node version, the `claude` CLI, gitleaks, the installed-version marker, the pre-commit config, and the gitignore block. Exits 0 if there are no errors (warnings are allowed). Exits 1 if any check fails.

## `status`

```sh
ai-knowledge-base status
```

Print a summary of pending work — queue depth, pending session logs, pending proposals, current node counts.

## `curate`

```sh
ai-knowledge-base curate [--batch-size <n>] [--token-budget <n>] [--timeout <ms>]
```

Run the curator non-interactively over every session log with `stage_2_status: done` that has not yet been curated. The command:

1. Acquires the curator lock on `.ai/.kb-builder/state.json` (`name: curator`, PID + 30-minute TTL). If another curate run holds the lock, exits with `locked` and no work done.
2. Batches pending session logs by count (`--batch-size`, default 10) and an estimated token budget (`--token-budget`, default 50000).
3. Spawns one `claude -p` subprocess per batch with the curator prompt, streaming JSON output to `.ai/knowledge-base/_logs/curator/<ulid>__<timestamp>.jsonl`.
4. Writes one proposal per non-drop action under `.ai/knowledge-base/_proposed/{additions,modifications,contradictions}/`.
5. Regenerates `INDEX.md` and `GRAPH.md` from the current `nodes/` tree (deterministic, no LLM).
6. Marks each session log with `curator_processed_at` and `curator_run_id` so it is not re-curated next run.

Contradiction proposals always carry `suggested_resolution: null` — the curator never auto-resolves; the reviewer chooses one of `supersede`, `keep_both`, or `reject` during `proposals review`.

Flags:

- `--batch-size <n>` — maximum session logs per curator batch. Default `10`.
- `--token-budget <n>` — approximate per-batch input token budget. Default `50000` (~4 chars per token).
- `--timeout <ms>` — per-batch subprocess timeout. Default `120000`.

## `node add`

```sh
ai-knowledge-base node add
```

Interactive CLI for capturing a single node manually. Uses `@inquirer/prompts` to collect `kind`, `title`, `summary`, `tags`, `relates_to`, `confidence`, and `body`. The result lands in `.ai/knowledge-base/_proposed/additions/<kind>-<slug>.md` with `proposal.kind: addition` and `proposal.rationale: "manual"`, never directly in `nodes/`.

After writing the proposal, INDEX and GRAPH are regenerated so the index doesn't drift while a manual proposal sits awaiting review.

The same path is available in-session as the `/kb:add` slash command.

## `proposals review`

```sh
ai-knowledge-base proposals review [--list]
```

Interactive TUI that walks every pending proposal under `_proposed/`. For additions and modifications, the reviewer accepts (moves the file into `nodes/<kind>/` and strips the `proposal` block) or rejects (deletes the proposal). For contradictions, the reviewer must first pick a `suggested_resolution` — `supersede`, `keep_both`, or `reject` — then accept. When the resolution is `supersede`, the target node is updated with `valid_until` and `superseded_by` automatically.

Flags:

- `--list` — print the pending proposals and exit. Useful for CI or scripting.

## `bootstrap-incremental`

```sh
ai-knowledge-base bootstrap-incremental --from <path> \
  [--include <glob>] [--exclude <glob>] \
  [--dry-run] [--token-budget <n>] [--timeout <ms>]
```

Re-bootstrap the KB from markdown documentation under `--from`. Hash-aware: processes only files whose SHA-256 changed since the last run (recorded in `.ai/.kb-builder/bootstrap-state.json`). The command:

1. Walks `--from` recursively, applying `.gitignore`, `--include`, and `--exclude` filters. Paths are matched relative to the repo root with posix separators.
2. Computes SHA-256 for each remaining file and compares it against `bootstrap-state.json`. Unchanged files are reported and skipped.
3. Acquires the `bootstrap-incremental` lock on `.ai/.kb-builder/state.json` (PID + 30-minute TTL). If another bootstrap is running, exits with `locked` and no work done.
4. Chunks the to-process set into batches sized by `--token-budget` (~4 chars per token; default `10000`).
5. Spawns one `claude -p` subprocess per batch with the [bootstrap-incremental prompt](../customization/bootstrap-incremental-prompt.md), streaming JSON output to `.ai/knowledge-base/_logs/bootstrap-incremental/<ulid>__<timestamp>.jsonl`.
6. Writes one `addition` proposal per LLM-emitted candidate under `.ai/knowledge-base/_proposed/additions/`, with `proposal.rationale: "bootstrap: <source-doc>"`, `derived_from: [<source-doc>]`, and `confidence: medium` by default.
7. Updates `bootstrap-state.json` with the new hash, timestamp, and proposal paths for each processed doc. Failed docs are left untouched so a re-run retries.

`--dry-run` reports what would be processed without invoking the LLM, writing proposals, or mutating state.

Glob syntax: `**` matches any number of path segments; `*` matches anything within a single segment; `?` matches a single non-slash character. `--include` and `--exclude` are repeatable; the include set acts as a whitelist (a file must match at least one include glob), the exclude set acts as a blocklist (any match wins).

Flags:

- `--from <path>` (required) — directory (or single file) to scan. Resolved relative to the repo root.
- `--include <glob>` — only process files matching at least one include glob. Repeatable.
- `--exclude <glob>` — skip any file matching one of these globs. Repeatable.
- `--dry-run` — report without invoking the LLM or mutating state.
- `--token-budget <n>` — approximate per-batch input token budget. Default `10000`.
- `--timeout <ms>` — per-batch subprocess timeout. Default `120000`.

See [Bootstrap > Incremental bootstrap](../bootstrap/incremental-bootstrap.md) for usage recipes and [Reference > `bootstrap-state.json` schema](bootstrap-state.md) for the state file shape.

## Commands available in later phases

| Command | Phase |
|---|---|
| `index rebuild` | M4 / M5 |

When those phases ship, this page will document each subcommand's full flag set and exit codes.
