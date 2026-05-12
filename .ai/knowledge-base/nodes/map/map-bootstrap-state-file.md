---
schema_version: 1
id: map-bootstrap-state-file
title: ".state/bootstrap-state.json: per-doc SHA-256 cache for bootstrap"
kind: map
tags: [state, bootstrap, hashing, gitignore]
valid_from: 2026-05-12T00:00:00Z
valid_until: null
updated: 2026-05-12T00:00:00Z
supersedes: null
superseded_by: null
derived_from:
  - docs/internals/schemas.md
relates_to: [map-ai-knowledge-base-cli]
depends_on: []
confidence: high
summary: "Records the SHA-256 of every doc the bootstrap pipelines have processed. Hash hits are skipped on re-runs. Gitignored. Delete to force a full re-bootstrap."
---

# `.state/bootstrap-state.json`: per-doc SHA-256 cache

Records the SHA-256 of every doc the bootstrap pipelines (`/kb-bootstrap` skill and `bootstrap-incremental` CLI) have processed. Hash hits are skipped on re-runs; hash misses are reprocessed and the entry is overwritten on success (left untouched on failure so a retry is safe).

Shape (validated by `BootstrapStateSchema`):

```json
{
  "schema_version": 1,
  "last_full_bootstrap_at": "<ISO>",
  "last_incremental_at": "<ISO>",
  "docs": {
    "<repo-relative-path>": {
      "content_sha256": "<hex>",
      "last_processed_at": "<ISO>",
      "produced_nodes": ["<kind>/<filename>.md", ...]
    }
  }
}
```

`last_full_bootstrap_at` is set by the `/kb-bootstrap` skill; `last_incremental_at` is set by `bootstrap-incremental` on non-dry-runs that processed at least one doc. `--dry-run` reads the file but never writes it. Gitignored. To force a full re-bootstrap, delete the file. Malformed contents are treated as missing.
