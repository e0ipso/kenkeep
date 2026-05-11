---
title: bootstrap-state.json schema
parent: Reference
nav_order: 5
---

# `bootstrap-state.json` schema

`bootstrap-state.json` records the SHA-256 of every doc the bootstrap pipelines have already processed. Both `/kb:bootstrap` (the agent-driven first-time pass) and `ai-knowledge-base bootstrap-incremental` (the CLI for re-runs) read and write this file. Hash-equal docs are skipped on subsequent runs.

- **Path:** `.ai/.kb-builder/bootstrap-state.json`
- **Gitignored:** yes (the gitignore block written by `init` covers it).
- **Schema version:** `1`.
- **Validator:** `BootstrapStateSchema` in `src/lib/schemas.ts`.

## Shape

```json
{
  "schema_version": 1,
  "last_full_bootstrap_at": "2026-05-10T14:30:00Z",
  "last_incremental_at": "2026-05-15T09:12:00Z",
  "docs": {
    "docs/architecture/auth.md": {
      "content_sha256": "abc123…",
      "last_processed_at": "2026-05-10T14:32:00Z",
      "produced_proposals": [
        "additions/practice-auth-flow.md",
        "additions/map-auth-module.md"
      ]
    },
    "README.md": {
      "content_sha256": "def456…",
      "last_processed_at": "2026-05-10T14:30:30Z",
      "produced_proposals": []
    }
  }
}
```

## Fields

| Field | Type | Meaning |
|---|---|---|
| `schema_version` | `1` (literal) | Schema version. Bumped on breaking changes. |
| `last_full_bootstrap_at` | ISO-8601 string \| null | Timestamp of the most recent `/kb:bootstrap` run. The slash command writes this when it finishes; never written by `bootstrap-incremental`. |
| `last_incremental_at` | ISO-8601 string \| null | Timestamp of the most recent `bootstrap-incremental` run. Updated on every non-dry-run that processed ≥1 doc. |
| `docs` | `Record<string, DocEntry>` | One entry per source doc that has been processed at least once. Keys are repo-root-relative posix paths. |

### `DocEntry`

| Field | Type | Meaning |
|---|---|---|
| `content_sha256` | hex string | SHA-256 of the file contents at the time it was processed. The CLI compares the live file's hash against this on subsequent runs and skips matches. |
| `last_processed_at` | ISO-8601 string | When this doc was last processed. |
| `produced_proposals` | `string[]` | Proposal paths the pipeline emitted from this doc, relative to `_proposed/`. Informational — used by `status` and future v2 features, not by the CLI itself for decisions. |

## Lifecycle

- **First run:** the file does not exist. The CLI initializes a fresh state with `docs: {}` and writes it after the first successful batch.
- **Hash hit:** if `docs[<path>].content_sha256` matches the live SHA-256, the doc is reported as "unchanged" and not sent to the LLM. `last_processed_at` is **not** updated for unchanged docs.
- **Hash miss:** the doc is queued for processing. On success, the entry is overwritten with the new hash, timestamp, and proposal paths. On failure, the entry is left untouched so a re-run retries.
- **`--dry-run`:** the file is read but never written.
- **Manual reset:** delete the file to force a full re-bootstrap of every doc under `--from`.

## Failure semantics

If `bootstrap-state.json` exists but fails Zod validation (e.g. someone hand-edited it into an invalid shape), the CLI treats it as missing and starts fresh. The malformed file is not deleted — fix it manually.

## See also

- [Bootstrap > Incremental bootstrap](../bootstrap/incremental-bootstrap.md) — the CLI that mutates this file.
- [Bootstrap > First-time bootstrap](../bootstrap/first-time-bootstrap.md) — the slash command that seeds this file.
- [IMPLEMENTATION §6.10.3](https://github.com/e0ipso/ai-knowledge-base/blob/main/IMPLEMENTATION.md#6103-bootstrap-state-file-schema) — design notes.
