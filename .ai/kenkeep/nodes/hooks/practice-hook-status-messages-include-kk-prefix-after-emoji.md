---
schema_version: 2
id: practice-hook-status-messages-include-kk-prefix-after-emoji
title: Hook status messages include kk prefix after emoji
kind: practice
tags:
  - hooks
  - messaging
  - ux
derived_from: []
relates_to:
  - map-capture-hook
  - map-session-start-hook
  - map-proposal-drain-hook
  - map-claude-harness
confidence: high
summary: >-
  All user-facing hook messages follow the pattern emoji kk Label: message to
  identify the knowledge base as the source.
---
Every user-facing status message emitted by harness hooks (session-start, lint-tick, capture, proposal-drain) includes "kk" between the leading emoji and the label. For example: `📖 kk Index: Loading knowledge base...`, `🔍 kk Lint: Running knowledge base lint...`, `📸 kk Capture: Saving session transcript...`, `🔄 kk Proposals: Draining queue...`.

This convention applies across all five harness adapters (Claude, Codex, Copilot, Cursor, OpenCode). The prefix helps users distinguish messages originating from the knowledge base system from those of other tools or extensions. Error diagnostics that use `PACKAGE_TAG` (`[kenkeep]`) are not affected by this rule.
