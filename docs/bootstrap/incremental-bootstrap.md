---
title: Incremental bootstrap
parent: Bootstrap
nav_order: 2
---

# Incremental bootstrap (`bootstrap-incremental`)

A deterministic, hash-aware CLI for re-bootstrapping the knowledge base after source docs are added or modified. It reads `.ai/knowledge-base/.state/bootstrap-state.json`, walks `--from`, skips files whose SHA-256 matches the recorded hash, chunks the remainder, and runs `claude -p` on each chunk with the [bootstrap-incremental prompt](../customization/bootstrap-incremental-prompt.md).

Idempotent and safe to re-run. No supervision required.

## Usage

```sh
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/ \
  [--include '**/*.md'] \
  [--exclude 'docs/legacy/**'] \
  [--dry-run] \
  [--token-budget 10000] \
  [--timeout 120000]
```

Flags:

- `--from <path>` (required) — directory (or single file) to scan. Resolved relative to the repo root.
- `--include <glob>` (repeatable) — only process files matching at least one include glob. Defaults to "all `.md` files".
- `--exclude <glob>` (repeatable) — skip any file matching one of these globs. Useful for `docs/legacy/**` or vendored content.
- `--dry-run` — report what would be processed without invoking the LLM or writing proposals or updating state.
- `--token-budget <n>` — approximate per-batch input token budget (~4 chars per token). Default `10000`.
- `--timeout <ms>` — per-batch subprocess timeout. Default `120000`.

Glob syntax: `**` matches any number of path segments; `*` matches anything within a single segment; `?` matches a single non-slash character. Paths are matched relative to the repo root with posix separators.

## What it does

1. **Walks `--from` recursively.** Discovers every `.md` file, applying `.gitignore` patterns from the repo root, then `--include`/`--exclude` filters.
2. **Hashes each file.** Computes SHA-256 of the file contents.
3. **Skips unchanged files.** Compares each hash against `bootstrap-state.json`. Matching hashes are reported as "unchanged" and not sent to the LLM.
4. **Chunks the to-process set.** Packs files into batches sized by `--token-budget` (single oversized files land alone).
5. **Spawns `claude -p` per batch.** Stream-JSON output is written to `.ai/knowledge-base/_logs/bootstrap-incremental/<run-id>__<timestamp>.jsonl`. The recursion guard env var (`KB_BUILDER_INTERNAL=1`) is always set on the child.
6. **Writes addition proposals.** Each candidate emitted by the LLM becomes a proposal under `_proposed/additions/<kind>-<slug>.md` with `proposal.kind: addition`, `proposal.rationale: "bootstrap: <source-doc>"`, and `derived_from` set to the chunked source files.
7. **Updates `bootstrap-state.json`.** Records the new hash, `last_processed_at`, and `produced_proposals` for each successfully processed doc. The state file's `last_incremental_at` is bumped to "now".

## Locking

`bootstrap-incremental` shares the `.ai/knowledge-base/.state/state.json` lock file with `kb-stage2-drain` and `curate`, but takes its own named lock (`name: bootstrap-incremental`, PID + 30-minute TTL). If a concurrent bootstrap is running, the new invocation exits with `locked` and does no work. If a stage-2 drain or curator run holds an unrelated lock, the bootstrap waits for nothing — the locks are name-scoped.

## Overlap with existing nodes

v1 always emits `addition` proposals. If a re-extracted proposal duplicates an existing accepted node, the reviewer rejects it. The reviewer is the merge mechanism; the CLI does not attempt curator-style modify/contradict logic. (Deferred to v2 per [IMPLEMENTATION §12](https://github.com/e0ipso/ai-knowledge-base/blob/main/IMPLEMENTATION.md#12-implementation-phases).)

## Recipes

### Dry-run after editing one doc

```sh
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/ --dry-run
```

Output reports the docs whose hash changed since the last run. Use this to sanity-check what a real run would touch before paying for it.

### Re-process only architecture docs

```sh
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/ --include 'docs/architecture/**'
```

### Skip vendored or legacy content

```sh
npx @e0ipso/ai-knowledge-base bootstrap-incremental --from docs/ \
  --exclude 'docs/legacy/**' \
  --exclude 'docs/vendored/**'
```

### CI: warn when docs change without proposal review

You can wire `bootstrap-incremental --dry-run` into CI to alert when docs change after bootstrap. The command exits 0 even when there's pending work; parse stdout (or the JSON log) for the "X file(s) would be processed" line.

## After a run

- `ai-knowledge-base proposals review` — accept or reject the new proposals.
- `cat .ai/knowledge-base/.state/bootstrap-state.json` — inspect the recorded hashes and timestamps.
- `ls .ai/knowledge-base/_logs/bootstrap-incremental/` — find the stream-JSON trace of every batch (filenames sort by ULID, so newest is last).

## State file schema

See [Reference > `bootstrap-state.json` schema](../reference/bootstrap-state.md).
