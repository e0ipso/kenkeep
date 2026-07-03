---
type: map
title: curate-dedup scoped session mode
description: '`curate-dedup --session-id` stamps only the matching done session log.'
tags:
  - curation
  - dedup
  - sessions
kk_schema_version: 3
kk_id: map-curate-dedup-scoped-session-mode
kk_derived_from:
  - '4c12545c-3224-4602-8b5a-14c752d26975:map:2'
kk_relates_to:
  - map-curate-command
  - map-session-log
  - map-kk-session-extract
kk_depends_on: []
kk_confidence: medium
---
# `curate-dedup --session-id`

`curate-dedup --session-id <uuid>` runs the normal curator-action deduplication and survivor/conflict write path while limiting session stamping to the unprocessed `proposal_status: done` log with the matching `session_id`.

This mode exists for `/kk-session-extract`, where a live session is staged and curated immediately. Without `--session-id`, `curate-dedup` keeps the default `/kk-curate` behavior: it stamps every unprocessed done session log in the queue.

<!-- kk:related:start -->
# Related

- Related: [map-curate-command](/curation/map-curate-command.md)
- Related: [map-session-log](/state/map-session-log.md)
- Related: [map-kk-session-extract](/curation/map-kk-session-extract.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [4c12545c-3224-4602-8b5a-14c752d26975:map:2](4c12545c-3224-4602-8b5a-14c752d26975:map:2)
<!-- kk:citations:end -->
