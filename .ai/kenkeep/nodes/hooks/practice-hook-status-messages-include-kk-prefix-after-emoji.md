---
type: practice
title: Hook status messages include kk prefix after emoji
description: >-
  All user-facing hook messages follow the pattern emoji kk Label: message to
  identify the knowledge base as the source.
tags:
  - hooks
  - messaging
  - ux
kk_schema_version: 3
kk_id: practice-hook-status-messages-include-kk-prefix-after-emoji
kk_derived_from: []
kk_relates_to:
  - map-capture-hook
  - map-session-start-hook
  - map-proposal-drain-hook
  - map-claude-harness
kk_depends_on: []
kk_confidence: high
---
Every user-facing status message emitted by harness hooks (session-start, lint-tick, capture, proposal-drain) includes "kk" between the leading emoji and the label. For example: `📖 kk Index: Loading knowledge base...`, `🔍 kk Lint: Running knowledge base lint...`, `📸 kk Capture: Saving session transcript...`, `🔄 kk Proposals: Draining queue...`.

This convention applies across all five harness adapters (Claude, Codex, Copilot, Cursor, OpenCode). The prefix helps users distinguish messages originating from the knowledge base system from those of other tools or extensions. Error diagnostics that use `PACKAGE_TAG` (`[kenkeep]`) are not affected by this rule.

<!-- kk:related:start -->
# Related

- Related: [map-capture-hook](/hooks/map-capture-hook.md)
- Related: [map-session-start-hook](/hooks/map-session-start-hook.md)
- Related: [map-proposal-drain-hook](/hooks/map-proposal-drain-hook.md)
- Related: [map-claude-harness](/harnesses/map-claude-harness.md)
<!-- kk:related:end -->
