---
title: Incremental bootstrap
parent: Bootstrap
nav_order: 2
---

# Incremental bootstrap (`bootstrap-incremental`)

Deterministic, hash-aware CLI. Reads `bootstrap-state.json`, walks `--from`, skips files whose SHA-256 matches the recorded hash, chunks the rest, and runs `claude -p` per chunk with the [bootstrap-incremental prompt](../customization/bootstrap-incremental-prompt.md).

Idempotent. Safe to re-run.

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

- `--from <path>` (required): directory or single file, relative to repo root.
- `--include <glob>` (repeatable): whitelist. Defaults to all `.md`.
- `--exclude <glob>` (repeatable): blocklist.
- `--dry-run`: report changes without invoking the LLM or writing state.
- `--token-budget <n>`: per-batch budget (~4 chars/token). Default `10000`.
- `--timeout <ms>`: per-batch timeout. Default `120000`.

Globs: `**` matches any path segments, `*` matches within one segment, `?` matches one non-slash char. Paths use posix separators relative to repo root.

## Behavior

1. Walks `--from`, applies `.gitignore`, `--include`, `--exclude`.
2. Hashes each file (SHA-256). Hash hits are skipped and reported as "unchanged".
3. Acquires the `bootstrap-incremental` lock (named, 30-min TTL).
4. Chunks the remainder by `--token-budget`. Oversized files batch alone.
5. Per batch: spawns `claude -p`, streams JSON to `_logs/bootstrap-incremental/<run-id>__<ts>.jsonl`, validates, writes addition proposals to `_proposed/additions/`.
6. Updates `bootstrap-state.json` per processed doc. Failed docs are left untouched so a re-run retries.

v1 always emits `addition` proposals. Duplicates of accepted nodes are rejected during review. (Modify/contradict logic is v2 work.)

## Recipes

Dry-run after editing one doc:

```sh
bootstrap-incremental --from docs/ --dry-run
```

Re-process only architecture docs:

```sh
bootstrap-incremental --from docs/ --include 'docs/architecture/**'
```

Skip vendored content:

```sh
bootstrap-incremental --from docs/ \
  --exclude 'docs/legacy/**' \
  --exclude 'docs/vendored/**'
```

## After a run

- `ai-knowledge-base proposals review`
- `cat .ai/knowledge-base/.state/bootstrap-state.json` for recorded hashes
- `_logs/bootstrap-incremental/` for stream-JSON traces

State file schema: [Reference > `bootstrap-state.json`](../reference/bootstrap-state.md).
