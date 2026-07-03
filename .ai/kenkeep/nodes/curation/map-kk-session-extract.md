---
type: map
title: kk-session-extract
description: >-
  Shared skill for extracting durable knowledge from the visible live session
  and immediately curating it.
tags:
  - skills
  - curation
  - sessions
kk_schema_version: 3
kk_id: map-kk-session-extract
kk_derived_from:
  - '4c12545c-3224-4602-8b5a-14c752d26975:map:1'
kk_relates_to:
  - map-session-log-stage-live
  - map-curate-dedup-scoped-session-mode
  - map-curate-command
kk_depends_on: []
kk_confidence: medium
---
# `/kk-session-extract`

`/kk-session-extract` is a shipped shared skill for live knowledge extraction from the current visible session. It applies the same proposal-extraction gate as the deferred capture path, stages the resulting proposal JSON through `session-log stage-live`, drafts curator actions, and runs the same curation tail for that one session.

The skill is for sessions that have just produced durable project knowledge and should be processed immediately. It uses `curate-dedup --session-id <staged-session-id>` so unrelated done session logs remain in the normal `/kk-curate` queue.

<!-- kk:related:start -->
# Related

- Related: [map-session-log-stage-live](/state/map-session-log-stage-live.md)
- Related: [map-curate-dedup-scoped-session-mode](/map-curate-dedup-scoped-session-mode.md)
- Related: [map-curate-command](/curation/map-curate-command.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [4c12545c-3224-4602-8b5a-14c752d26975:map:1](4c12545c-3224-4602-8b5a-14c752d26975:map:1)
<!-- kk:citations:end -->
