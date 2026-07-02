---
type: practice
title: init and upgrade inject a static kk index pointer into AGENTS.md
description: >-
  During init and upgrade, a static one-line pointer to ENTRY.md is appended to
  AGENTS.md, guarded by sentinel markers for idempotency.
tags:
  - init
  - upgrade
  - agents-md
  - index
  - markers
kk_schema_version: 3
kk_id: practice-init-and-upgrade-inject-a-static-kk-index-pointer-into-agents-md
kk_derived_from: []
kk_relates_to:
  - map-entry-md
  - map-session-start-hook
kk_depends_on: []
kk_confidence: high
---
The `runInit()` and `runUpgrade()` functions call `updateAgentsMd()` to inject a static pointer block into `AGENTS.md`. The block uses sentinel markers so the operation is idempotent:

```
<!-- >>> kenkeep:kk-index >>> -->
Curated project knowledge lives in [.ai/kenkeep/ENTRY.md](.ai/kenkeep/ENTRY.md). Consult it before designing a non-trivial change.
<!-- <<< kenkeep:kk-index <<< -->
```

Detection is a substring match for the start sentinel. If found, the block between markers is replaced in place. If not found, the block is appended. A static pointer (not the full index content) is used to avoid token duplication with the session-start hook and to avoid staleness.

<!-- kk:related:start -->
# Related

- Related: [map-entry-md](/index/map-entry-md.md)
- Related: [map-session-start-hook](/hooks/map-session-start-hook.md)
<!-- kk:related:end -->
