---
title: bootstrap-state.json schema
parent: Reference
nav_order: 5
---

# `bootstrap-state.json`

Records the SHA-256 of every doc the bootstrap pipelines have already processed. Both `/kb-bootstrap` and `bootstrap-incremental` read and write it. Hash-equal docs are skipped on re-runs.

- **Path**: `.ai/knowledge-base/.state/bootstrap-state.json`
- **Gitignored**: yes
- **Schema**: `BootstrapStateSchema` in `src/lib/schemas.ts`
- **Version**: `1`

## Shape

```json
{
  "schema_version": 1,
  "last_full_bootstrap_at": "2026-05-10T14:30:00Z",
  "last_incremental_at": "2026-05-15T09:12:00Z",
  "docs": {
    "docs/architecture/auth.md": {
      "content_sha256": "abc123...",
      "last_processed_at": "2026-05-10T14:32:00Z",
      "produced_proposals": [
        "additions/practice-auth-flow.md",
        "additions/map-auth-module.md"
      ]
    }
  }
}
```

| Field | Meaning |
|---|---|
| `last_full_bootstrap_at` | Last `/kb-bootstrap` run. Never set by the CLI. |
| `last_incremental_at` | Last `bootstrap-incremental` non-dry-run that processed ≥1 doc. |
| `docs` | Per-doc entries keyed by repo-root-relative posix path. |
| `docs[].content_sha256` | SHA-256 of file contents at processing time. |
| `docs[].last_processed_at` | Timestamp of last processing. Not updated on hash hits. |
| `docs[].produced_proposals` | Proposal paths emitted. Informational. |

## Lifecycle

- **First run**: file is created with `docs: {}`.
- **Hash hit**: doc is skipped; `last_processed_at` is not updated.
- **Hash miss**: doc is queued. On success, the entry is overwritten. On failure, the entry is left untouched so a re-run retries.
- **`--dry-run`**: file is read, never written.
- **Force re-bootstrap**: delete the file.

A malformed file is treated as missing; the CLI does not delete it.
