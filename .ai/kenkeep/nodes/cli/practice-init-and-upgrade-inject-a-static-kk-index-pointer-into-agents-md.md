---
schema_version: 2
id: practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md
title: init and upgrade inject a static kk index pointer into AGENTS.md
kind: practice
tags:
  - init
  - upgrade
  - agents-md
  - index
  - markers
derived_from: []
relates_to:
  - map-entry-md
  - map-session-start-hook
confidence: high
summary: >-
  During init and upgrade, a static one-line pointer to ENTRY.md is appended to
  AGENTS.md, guarded by sentinel markers for idempotency.
---
The `runInit()` and `runUpgrade()` functions call `updateAgentsMd()` to inject a static pointer block into `AGENTS.md`. The block uses sentinel markers so the operation is idempotent:

```
<!-- >>> kenkeep:kk-index >>> -->
Curated project knowledge lives in [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md). Consult it before designing a non-trivial change.
<!-- <<< kenkeep:kk-index <<< -->
```

Detection is a substring match for the start sentinel. If found, the block between markers is replaced in place. If not found, the block is appended. A static pointer (not the full index content) is used to avoid token duplication with the session-start hook and to avoid staleness.
