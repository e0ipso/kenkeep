---
type: practice
title: Copilot file-based SessionStart must use shared context builder
description: >-
  Copilot lacks additionalContext, but its sentinel bridge must still preserve
  shared SessionStart status.
tags:
  - copilot
  - harness
  - hooks
  - sessionstart
  - context-injection
  - drift
kk_schema_version: 3
kk_id: practice-copilot-file-based-sessionstart-must-use-shared-context-builder
kk_derived_from: []
kk_relates_to:
  - map-copilot-harness-adapter
  - map-session-start-hook
kk_depends_on: []
kk_confidence: high
---
Copilot has no documented SessionStart stdout `additionalContext` channel, so the adapter writes session-start context into `.github/copilot-instructions.md` under the kk sentinel.

That file-based bridge is only the transport. It must still use `buildSessionStartContext` and `buildNudgeContent` like the other harnesses so stale-index warnings, curation queue status, lint summaries, and `/kk-curate` nudges do not drift.

<!-- kk:related:start -->
# Related

- Related: [map-copilot-harness-adapter](/harnesses/map-copilot-harness-adapter.md)
- Related: [map-session-start-hook](/hooks/map-session-start-hook.md)
<!-- kk:related:end -->
