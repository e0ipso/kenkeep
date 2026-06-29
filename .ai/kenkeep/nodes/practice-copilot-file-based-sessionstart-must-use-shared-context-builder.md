---
schema_version: 2
id: practice-copilot-file-based-sessionstart-must-use-shared-context-builder
title: Copilot file-based SessionStart must use shared context builder
kind: practice
tags:
  - copilot
  - harness
  - hooks
  - sessionstart
  - context-injection
  - drift
derived_from: []
relates_to:
  - map-copilot-harness-adapter
  - map-session-start-hook
depends_on: []
confidence: high
summary: >-
  Copilot lacks additionalContext, but its sentinel bridge must still preserve
  shared SessionStart status.
---
Copilot has no documented SessionStart stdout `additionalContext` channel, so the adapter writes session-start context into `.github/copilot-instructions.md` under the kk sentinel.

That file-based bridge is only the transport. It must still use `buildSessionStartContext` and `buildNudgeContent` like the other harnesses so stale-index warnings, curation queue status, lint summaries, and `/kk-curate` nudges do not drift.
