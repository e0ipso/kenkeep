---
type: map
title: session-log stage-live
description: >-
  Deterministic CLI primitive that stages live proposal JSON into a done session
  log.
tags:
  - session-log
  - cli
  - curation
kk_schema_version: 3
kk_id: map-session-log-stage-live
kk_derived_from:
  - '4c12545c-3224-4602-8b5a-14c752d26975:map:0'
kk_relates_to:
  - map-session-log
  - map-curate-command
kk_depends_on: []
kk_confidence: medium
---
# `session-log stage-live`

`session-log stage-live` is a deterministic CLI primitive for `/kk-session-extract`. It validates `ProposalOutputSchema` JSON from stdin, then writes or updates a `_sessions/*.md` log with `proposal_status: done` and `captured_by: manual`.

Use it when the current visible session already produced durable teaching moments and the user wants to curate that session immediately instead of waiting for the normal capture plus proposal-drain path. The primitive is pure Node and does not call an LLM; the surrounding skill is responsible for producing the proposal JSON and continuing through the curation tail.

<!-- kk:related:start -->
# Related

- Related: [map-session-log](/state/map-session-log.md)
- Related: [map-curate-command](/curation/map-curate-command.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [4c12545c-3224-4602-8b5a-14c752d26975:map:0](4c12545c-3224-4602-8b5a-14c752d26975:map:0)
<!-- kk:citations:end -->
