---
type: map
title: kk-prompt-context.cjs (prompt-time injection)
description: >-
  Prompt-time hook for Claude and Codex that emits hookSpecificOutput
  additionalContext after the user's prompt is known.
tags:
  - hooks
  - prompt-time
  - codex
  - claude
kk_schema_version: 3
kk_id: map-kk-prompt-context-cjs-prompt-time-injection
kk_derived_from:
  - '019f1e24-76c6-7751-a01f-9a408a7e44e8:map:0'
kk_relates_to:
  - map-session-start-hook
  - map-codex-harness
  - map-claude-harness
kk_depends_on: []
kk_confidence: high
---
# `kk-prompt-context.cjs` (prompt-time injection)

`kk-prompt-context.cjs` is the synchronous prompt-time knowledge hook installed only for harnesses with a verified native prompt-submit context channel: Claude Code and Codex. It runs on `UserPromptSubmit`, ranks existing leaf nodes against the submitted prompt through the deterministic prompt-retrieval core, and injects a bounded summaries-plus-links block as additional context.

Claude and Codex consume the same envelope shape for this hook:

```json
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"..."}}
```

When nothing relevant is found, the hook emits no context. Cursor, OpenCode, and Copilot do not register prompt-time injection until a native prompt-context channel is verified for those hosts.

<!-- kk:related:start -->
# Related

- Related: [map-session-start-hook](/hooks/map-session-start-hook.md)
- Related: [map-codex-harness](/harnesses/map-codex-harness.md)
- Related: [map-claude-harness](/harnesses/map-claude-harness.md)
<!-- kk:related:end -->

<!-- kk:citations:start -->
# Citations

[1] [019f1e24-76c6-7751-a01f-9a408a7e44e8:map:0](019f1e24-76c6-7751-a01f-9a408a7e44e8:map:0)
<!-- kk:citations:end -->
