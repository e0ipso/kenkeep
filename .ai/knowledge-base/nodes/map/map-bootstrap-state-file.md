---
schema_version: 1
id: map-bootstrap-state-file
title: '.state/bootstrap-state.json: per-doc SHA-256 cache for bootstrap'
kind: map
tags:
  - state
  - bootstrap
  - hashing
  - gitignore
valid_from: '2026-05-12T09:59:17.929Z'
valid_until: null
updated: '2026-05-12T11:48:24.254Z'
supersedes: null
superseded_by: null
derived_from:
  - 20260512-0959-f963bf78b135.md
relates_to:
  - practice-bootstrap-skip-changelog-and-implementation
depends_on: []
confidence: high
summary: >-
  Per-doc SHA-256 cache at .ai/knowledge-base/.state/bootstrap-state.json;
  tracks produced nodes and bootstrap timestamps. Gitignored.
---
`.ai/knowledge-base/.state/bootstrap-state.json` is the cache that lets `bootstrap-incremental` skip docs whose content has not changed.

For every doc the bootstrap pipelines read, the file records:

- `content_sha256`: hash of the doc at the time it was processed
- `last_processed_at`: ISO timestamp
- `produced_nodes`: ids of the nodes that bootstrap derived from this doc

The file also tracks pipeline-wide state:

- `last_full_bootstrap_at`
- `last_incremental_at`
- `schema_version: 1`

On re-runs, files whose current SHA-256 matches the cached hash are skipped. Gitignored. Delete the file to force a full re-bootstrap.

See [[practice-bootstrap-skip-changelog-and-implementation]] for which docs bootstrap reads in the first place.
