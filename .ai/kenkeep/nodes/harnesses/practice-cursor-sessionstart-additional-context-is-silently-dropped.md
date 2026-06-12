---
schema_version: 2
id: practice-cursor-sessionstart-additional-context-is-silently-dropped
title: Cursor sessionStart additional_context delivery was fixed upstream
kind: practice
tags:
  - cursor
  - harness
  - hooks
  - context-injection
derived_from: []
relates_to:
  - map-cursor-harness-adapter
confidence: high
summary: >-
  The silent-drop bug existed ~May 2026 and was fixed by Cursor upstream.
  kenkeep now injects via additional_context AND the AGENTS.md sentinel as a
  belt-and-braces pair.
---
The `additional_context` silent-drop bug existed approximately May 2026: Cursor logged the field as "merged successfully" but dropped it before the agent window was created. Cursor fixed this upstream.

Live end-to-end measurement on cursor-agent (2026-06-12) with secret-codeword payloads at 12 KB and 60 KB confirmed that `sessionStart` `additional_context` now reliably reaches the model.

The Cursor adapter in this project injects the knowledge base index via `additional_context` in the hook response AND via an AGENTS.md sentinel block (belt-and-braces). Both channels are active. The `.cursor/rules/` fallback is no longer the only reliable path.
