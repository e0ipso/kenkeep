---
type: practice
title: Cursor sessionStart additional_context delivery was fixed upstream
description: >-
  Silent-drop bug (~May 2026) fixed upstream by Cursor; kenkeep injects via
  additional_context AND the AGENTS.md sentinel, belt-and-braces.
tags:
  - cursor
  - harness
  - hooks
  - context-injection
kk_schema_version: 3
kk_id: practice-cursor-sessionstart-additional-context-is-silently-dropped
kk_derived_from: []
kk_relates_to:
  - map-cursor-harness-adapter
kk_depends_on: []
kk_confidence: high
---
The `additional_context` silent-drop bug existed approximately May 2026: Cursor logged the field as "merged successfully" but dropped it before the agent window was created. Cursor fixed this upstream.

Live end-to-end measurement on cursor-agent (2026-06-12) with secret-codeword payloads at 12 KB and 60 KB confirmed that `sessionStart` `additional_context` now reliably reaches the model.

The Cursor adapter in this project injects the knowledge base index via `additional_context` in the hook response AND via an AGENTS.md sentinel block (belt-and-braces). Both channels are active. The `.cursor/rules/` fallback is no longer the only reliable path.

<!-- kk:related:start -->
# Related

- Related: [map-cursor-harness-adapter](/harnesses/map-cursor-harness-adapter.md)
<!-- kk:related:end -->
