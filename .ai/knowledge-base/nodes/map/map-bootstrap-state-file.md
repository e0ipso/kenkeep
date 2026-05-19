---
schema_version: 1
id: map-bootstrap-state-file
title: ".state/bootstrap-state.json (per-doc hash cache)"
kind: map
tags: [bootstrap, hash, state, schema]
derived_from:
  - docs/internals/schemas.md
  - docs/troubleshooting.md
relates_to:
  - map-bootstrap-incremental-command
depends_on: []
confidence: high
summary: "Per-doc SHA-256 cache used by bootstrap-incremental for hash-aware re-runs. Gitignored."
---

# `.state/bootstrap-state.json`

Gitignored. Records the SHA-256 of every doc the bootstrap pipelines have processed so subsequent runs skip unchanged docs.

```json
{
  "schema_version": 1,
  "last_full_bootstrap_at": "<ISO>",
  "last_incremental_at": "<ISO>",
  "docs": {
    "docs/architecture/auth.md": {
      "content_sha256": "abc123...",
      "last_processed_at": "<ISO>",
      "produced_nodes": ["practice/practice-auth-flow.md", "map/map-auth-module.md"]
    }
  }
}
```

| Field | Meaning |
|---|---|
| `last_full_bootstrap_at` | Last `/kb-bootstrap` run. Never set by the CLI. |
| `last_incremental_at` | Last `bootstrap-incremental` non-dry-run that processed ≥1 doc. |
| `docs[].content_sha256` | SHA-256 of file contents at processing time. |
| `docs[].last_processed_at` | Timestamp of last processing. **Not** updated on hash hits. |
| `docs[].produced_nodes` | `<kind>/<filename>.md` paths (relative to `nodes/`) written from this doc. Informational. |

Lifecycle:

- **First run** — file is created with `docs: {}`.
- **Hash hit** — doc is skipped; `last_processed_at` is not updated.
- **Hash miss** — doc is queued; on success the entry is overwritten, on failure the entry is left untouched so a re-run retries.
- **`--dry-run`** — file is read, never written.
- **Force re-bootstrap** — delete the file.

A malformed file is treated as missing. Validated by `BootstrapStateSchema`.
