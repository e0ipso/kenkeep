---
type: map
title: Usage ledger depends on successful capture
description: >-
  usage.jsonl records node reads only from sessions whose capture hook persists
  usage rows.
tags:
  - usage
  - capture
  - state
  - hooks
kk_schema_version: 3
kk_id: map-usage-ledger-depends-on-successful-capture
kk_derived_from:
  - '019f1e24-76c6-7751-a01f-9a408a7e44e8:map:1'
kk_relates_to:
  - map-capture-hook
  - map-session-log
kk_depends_on: []
kk_confidence: medium
---
# Usage ledger depends on successful capture

The `.ai/kenkeep/.state/usage.jsonl` ledger reflects knowledge-base document reads only when a harness capture hook runs successfully and persists usage rows. Raw host transcripts or rollouts can contain classifiable node reads that never appear in the ledger if `kk-capture` did not run with a usable payload or did not write the session.

The usage layer is best-effort instrumentation. Missing historical usage rows usually point to a capture invocation problem rather than proof that the read-extraction parser cannot classify the raw transcript.

<!-- kk:related:start -->
# Related

- Related: [map-capture-hook](/hooks/map-capture-hook.md)
- Related: [map-session-log](/state/map-session-log.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [019f1e24-76c6-7751-a01f-9a408a7e44e8:map:1](019f1e24-76c6-7751-a01f-9a408a7e44e8:map:1)
<!-- kk:citations:end -->
